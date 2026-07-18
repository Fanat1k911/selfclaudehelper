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
from sqlalchemy.orm import Session, selectinload

from app.config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET
from app.constants import USER_STATUS_ACTIVE
from app.db import Base, get_db
from app.models import CompanyMembership, User

_ModelT = TypeVar("_ModelT", bound=Base)

_bearer = HTTPBearer(auto_error=False)

# Та же логика троттлинга, что была в core/auth.py, но по ключу логина (процесс общий
# на всех клиентов, in-memory session_state здесь нет).
_ATTEMPTS_BEFORE_DELAY = 3
_MAX_DELAY_SECONDS = 8
_login_attempts: dict[str, int] = {}

# Короткоживущий токен для второго шага логина (см. authenticate/select_company ниже) —
# отдельный тип JWT, не полноценная сессия: не несёт company_id/role, годится только
# на вызов /api/auth/select-company, expiry на порядки короче обычного access-токена.
PENDING_TOKEN_TYPE = "pending_company_choice"
_PENDING_TOKEN_EXPIRE_MINUTES = 5


def _find_user(db: Session, login: str) -> User | None:
    login_norm = login.strip().casefold()
    return db.scalar(select(User).where(User.login.ilike(login_norm)))


def _company_memberships(db: Session, user_id: str) -> list[CompanyMembership]:
    """selectinload(.company) — без него каждый `.company.name` ниже был отдельным SELECT
    (N+1 на каждый логин/select-company/switch-company, растёт с числом компаний юзера;
    поймано code-review 2026-07-18)."""
    stmt = (
        select(CompanyMembership)
        .where(CompanyMembership.user_id == user_id)
        .options(selectinload(CompanyMembership.company))
    )
    return list(db.scalars(stmt))


def _memberships_payload(db: Session, user_id: str) -> list[dict]:
    return [{"id": m.company_id, "name": m.company.name, "role": m.role} for m in _company_memberships(db, user_id)]


def _public_fields(user: User, membership: CompanyMembership, companies: list[dict]) -> dict:
    return {
        "id": user.id, "fio": user.fio, "login": user.login, "role": membership.role,
        "company_id": membership.company_id, "company_name": membership.company.name,
        "companies": companies,
    }


def _mint_pending_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": PENDING_TOKEN_TYPE,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=_PENDING_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def authenticate(login: str, password: str, db: Session) -> dict:
    """Проверяет логин/пароль. Кидает HTTPException(401) при неудаче. Если у аккаунта
    одна компания — отдаёт публичные поля для JWT-payload как раньше (99% пользователей,
    без лишнего шага). Если компаний несколько (2026-07-18, см. CLAUDE.md → "Мульти-
    компанийные пользователи") — не логинит сразу, отдаёт короткоживущий pending_token
    + список компаний на выбор; финализирует select_company()."""
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

    memberships = _company_memberships(db, user.id)
    if not memberships:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "У аккаунта нет доступа ни к одной компании.")

    companies = [{"id": m.company_id, "name": m.company.name, "role": m.role} for m in memberships]

    if len(memberships) == 1:
        return {"status": "ok", "user": _public_fields(user, memberships[0], companies)}

    return {"status": "choose_company", "pending_token": _mint_pending_token(user.id), "companies": companies}


def select_company(pending_token: str, company_id: str, db: Session) -> dict:
    """Второй шаг логина при нескольких компаниях — pending_token с первого шага +
    выбранная компания, отдаёт те же публичные поля, что и обычный однокомпанийный вход."""
    try:
        payload = jwt.decode(pending_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Токен выбора компании недействителен или истёк.")
    if payload.get("type") != PENDING_TOKEN_TYPE:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Недействительный токен.")

    user = db.get(User, payload["sub"])
    if user is None or user.status != USER_STATUS_ACTIVE:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Доступ отозван.")

    membership = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.user_id == user.id, CompanyMembership.company_id == company_id
        )
    )
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Нет доступа к этой компании.")

    companies = _memberships_payload(db, user.id)
    return {"status": "ok", "user": _public_fields(user, membership, companies)}


def switch_company(current_user_id: str, company_id: str, db: Session) -> dict:
    """Переключение активной компании для уже залогиненного пользователя (сайдбар,
    см. CLAUDE.md) — без повторного ввода пароля, просто переиздаёт токен на другое
    членство того же человека."""
    membership = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.user_id == current_user_id, CompanyMembership.company_id == company_id
        )
    )
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Нет доступа к этой компании.")

    user = db.get(User, current_user_id)
    if user is None or user.status != USER_STATUS_ACTIVE:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Доступ отозван.")

    companies = _memberships_payload(db, user.id)
    return _public_fields(user, membership, companies)


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

    # pending_token (см. select_company) подписан тем же JWT_SECRET, но несёт только
    # {sub, type, exp} — без этой проверки он проходит jwt.decode как обычный токен и
    # падает KeyError->500 на payload["login"] ниже вместо чистого 401 (был баг, пойман
    # code-review 2026-07-18: reproduced — GET /auth/me с pending_token давал 500).
    if payload.get("type") is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Токен недействителен для этого запроса.")

    # Перепроверяем статус в БД на каждый запрос — уволенный сотрудник теряет доступ
    # сразу, а не только после истечения токена.
    login = payload.get("login")
    if login is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Токен устарел, войдите заново.")
    fresh = _find_user(db, login)
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
        # .get() с фоллбеком на [текущая компания] — токены, выданные до мульти-компанийных
        # пользователей (2026-07-18), companies не несут; не форсим релогин ради этого одного
        # поля, оно нужно только для переключалки компаний в сайдбаре (не для авторизации).
        "companies": payload.get("companies") or [{"id": company_id, "name": company_name, "role": payload["role"]}],
    }


def get_owned_or_404(db: Session, model: type[_ModelT], id_: str, company_id: str, not_found_message: str) -> _ModelT:
    """Мультитенантность: fetch-by-id-or-404 с проверкой company_id в одном месте, а не
    отдельной копией в каждом роутере (см. CLAUDE.md — забытый фильтр это критический баг).
    404, не 403 — не подтверждаем даже факт существования чужой записи."""
    obj = db.get(model, id_)
    if obj is None or obj.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, not_found_message)
    return obj


def attach_or_create_membership(
    db: Session,
    *,
    login: str,
    company_id: str,
    role: str,
    password: str,
    fio: str | None = None,
    phone: str | None = None,
    messenger: str | None = None,
    address: str | None = None,
    document: str | None = None,
) -> tuple[User, bool]:
    """Единая логика "существующий логин = приглашение, не ошибка" (вариант А, см. CLAUDE.md
    → "Мульти-компанийные пользователи") — общая для app/routers/companies.py, users.py и
    scripts/create_founder.py, раньше была продублирована в трёх местах порознь.

    Существующий логин ТРЕБУЕТ совпадения пароля — без этой проверки любой Founder/Developer
    мог бы привязать ЧУЖОЙ аккаунт к своей компании, зная только логин (не пароль), и затем
    reset-password сменить его ГЛОБАЛЬНЫЙ пароль (см. security-review 2026-07-18, было дырой
    до этого коммита). Уволенный (status != ACTIVE) существующий аккаунт тоже отклоняется —
    молчаливая привязка неактивного юзера выглядела бы как успех, но человек всё равно не
    смог бы зайти, сбивая с толку того, кто его "нанял".

    Коммитит транзакцию сам (все три вызывающих места делали то же самое сразу после).
    Возвращает (user, attached_existing)."""
    login = login.strip()
    existing = db.scalar(select(User).where(User.login.ilike(login)))

    if existing:
        if not password or not bcrypt.checkpw(password.encode("utf-8"), existing.password_hash.encode("utf-8")):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Неверный пароль для существующего аккаунта.")
        if existing.status != USER_STATUS_ACTIVE:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Этот аккаунт уволен, привязать нельзя.")
        dup = db.scalar(
            select(CompanyMembership).where(
                CompanyMembership.user_id == existing.id, CompanyMembership.company_id == company_id
            )
        )
        if dup:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Этот человек уже состоит в этой компании.")
        db.add(CompanyMembership(user_id=existing.id, company_id=company_id, role=role))
        db.commit()
        return existing, True

    if not fio or not fio.strip() or not password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "ФИО и пароль обязательны для нового аккаунта.")

    new_user = User(
        fio=fio.strip(),
        login=login,
        password_hash=bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode(),
        status=USER_STATUS_ACTIVE,
        phone=phone or None,
        messenger=messenger or None,
        address=address or None,
        document=document or None,
    )
    db.add(new_user)
    db.flush()
    db.add(CompanyMembership(user_id=new_user.id, company_id=company_id, role=role))
    db.commit()
    return new_user, False


def require_roles(*allowed_roles: str):
    def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет доступа к этому разделу.")
        return user

    return _dep
