"""Логин на bcrypt + JWT — сессия не st.session_state (сервер без состояния,
клиент React), а подписанный токен, который фронт хранит и шлёт в Authorization header."""

import time
from datetime import datetime, timedelta, timezone
from typing import TypeVar

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET
from app.constants import USER_STATUS_ACTIVE
from app.db import Base, get_db
from app.models import User

_ModelT = TypeVar("_ModelT", bound=Base)

_bearer = HTTPBearer(auto_error=False)

# Та же логика троттлинга, что была в core/auth.py, но по ключу логина (процесс общий
# на всех клиентов, in-memory session_state здесь нет).
_ATTEMPTS_BEFORE_DELAY = 3
_MAX_DELAY_SECONDS = 8
_login_attempts: dict[str, int] = {}


def _find_user(db: Session, login: str) -> User | None:
    login_norm = login.strip().casefold()
    return db.scalar(select(User).where(User.login.ilike(login_norm)))


def _public_fields(user: User) -> dict:
    return {
        "id": user.id, "fio": user.fio, "login": user.login, "role": user.role,
        "company_id": user.company_id, "company_name": user.company.name,
    }


def authenticate(login: str, password: str, db: Session) -> dict:
    """Проверяет логин/пароль. Кидает HTTPException(401) при неудаче, иначе отдаёт
    публичные поля пользователя для JWT-payload."""
    attempts = _login_attempts.get(login.strip().casefold(), 0)
    if attempts >= _ATTEMPTS_BEFORE_DELAY:
        time.sleep(min(attempts, _MAX_DELAY_SECONDS))

    user = _find_user(db, login)
    ok = user is not None and user.status == USER_STATUS_ACTIVE
    if ok:
        try:
            ok = bcrypt.checkpw(password.encode("utf-8"), user.password_hash.encode("utf-8"))
        except ValueError:
            ok = False

    key = login.strip().casefold()
    if not ok:
        _login_attempts[key] = _login_attempts.get(key, 0) + 1
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный логин или пароль.")

    _login_attempts.pop(key, None)
    return _public_fields(user)


def create_access_token(user: dict) -> str:
    payload = {
        **user,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> dict:
    """Проверка на каждый запрос — программно (см. CLAUDE.md: роль проверяется не
    скрытием UI, а на каждом обращении к данным)."""
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Нужно войти в систему.")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Токен недействителен или истёк.")

    # Перепроверяем статус в БД на каждый запрос — уволенный сотрудник теряет доступ
    # сразу, а не только после истечения токена.
    fresh = _find_user(db, payload["login"])
    if fresh is None or fresh.status != USER_STATUS_ACTIVE:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Доступ отозван.")
    # company_id и company_name — как и role, берутся из payload токена, не перечитываются
    # из БД (пользователь не переезжает между компаниями, в отличие от статуса/увольнения).
    # .get(), не payload["company_id"]: токены, выданные до мультитенантности (2026-07-16)
    # или до вайт-лейбла (company_name добавлен отдельным деплоем позже), этих полей не
    # несут — без .get() падает KeyError -> 500 вместо чистого 401. Оба обязательны и оба
    # требуют релогина, если хоть одно отсутствует: иначе на компанию Б мог утечь через
    # фронтовый фоллбек чужой бренд компании А, пока не истечёт старый токен.
    company_id = payload.get("company_id")
    company_name = payload.get("company_name")
    if company_id is None or company_name is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Токен устарел, войдите заново.")
    return {
        "id": payload["id"], "fio": payload["fio"], "login": payload["login"],
        "role": payload["role"], "company_id": company_id, "company_name": company_name,
    }


def get_owned_or_404(db: Session, model: type[_ModelT], id_: str, company_id: str, not_found_message: str) -> _ModelT:
    """Мультитенантность: fetch-by-id-or-404 с проверкой company_id в одном месте, а не
    отдельной копией в каждом роутере (см. CLAUDE.md — забытый фильтр это критический баг).
    404, не 403 — не подтверждаем даже факт существования чужой записи."""
    obj = db.get(model, id_)
    if obj is None or obj.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, not_found_message)
    return obj


def require_roles(*allowed_roles: str):
    def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет доступа к этому разделу.")
        return user

    return _dep
