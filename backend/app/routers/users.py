"""Управление сотрудниками (роадмап-шаг 6) — доступно только founder/developer
(см. таблицу ролей в CLAUDE.md). Увольнение — не DELETE, а смена status на
USER_STATUS_FIRED: security.get_current_user перепроверяет статус на каждый запрос,
так что уволенный теряет доступ сразу же, история (Production/Sales) не рвётся
чужим foreign key.

Мультитенантность: список/изменение сотрудников — только внутри своей компании.
Логин остаётся глобально уникальным (не per-company) — см. CLAUDE.md."""

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER, USER_ROLES, USER_STATUS_ACTIVE

from app.db import get_db
from app.models import User
from app.schemas import NewUserRequest, ResetPasswordRequest, UpdateUserRequest
from app.security import get_current_user, get_owned_or_404, require_roles

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))])


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "fio": user.fio,
        "login": user.login,
        "role": user.role,
        "status": user.status,
        "created_at": user.created_at.isoformat(),
        "phone": user.phone or "",
        "messenger": user.messenger or "",
        "address": user.address or "",
        "document": user.document or "",
    }


def _get_own_user(db: Session, user_id: str, company_id: str) -> User:
    return get_owned_or_404(db, User, user_id, company_id, "Сотрудник не найден.")


@router.get("")
def list_users(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(User).where(User.company_id == user["company_id"]).order_by(User.fio)
    return [_user_dict(u) for u in db.scalars(stmt)]


@router.post("")
def create_user(body: NewUserRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if body.role not in USER_ROLES:
        raise HTTPException(400, f"Недопустимая роль. Разрешены: {', '.join(USER_ROLES)}.")
    if not body.fio.strip() or not body.login.strip() or not body.password:
        raise HTTPException(400, "ФИО, логин и пароль обязательны.")

    # Логин уникален глобально (не per-company) — вход не спрашивает "какая компания".
    existing = db.scalar(select(User).where(User.login.ilike(body.login.strip())))
    if existing:
        raise HTTPException(400, "Такой логин уже занят.")

    new_user = User(
        company_id=user["company_id"],
        fio=body.fio.strip(),
        login=body.login.strip(),
        password_hash=bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode(),
        role=body.role,
        status=USER_STATUS_ACTIVE,
        phone=body.phone or None,
        messenger=body.messenger or None,
        address=body.address or None,
        document=body.document or None,
    )
    db.add(new_user)
    db.commit()
    return {"id": new_user.id}


@router.patch("/{user_id}")
def update_user(
    user_id: str, body: UpdateUserRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    target = _get_own_user(db, user_id, user["company_id"])

    if body.role is not None:
        if body.role not in USER_ROLES:
            raise HTTPException(400, f"Недопустимая роль. Разрешены: {', '.join(USER_ROLES)}.")
        target.role = body.role
    if body.status is not None:
        target.status = body.status
    if body.fio is not None:
        target.fio = body.fio.strip()
    if body.phone is not None:
        target.phone = body.phone or None
    if body.messenger is not None:
        target.messenger = body.messenger or None
    if body.address is not None:
        target.address = body.address or None
    if body.document is not None:
        target.document = body.document or None

    db.commit()
    return _user_dict(target)


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: str, body: ResetPasswordRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    target = _get_own_user(db, user_id, user["company_id"])
    if not body.new_password:
        raise HTTPException(400, "Пароль не может быть пустым.")

    target.password_hash = bcrypt.hashpw(body.new_password.encode("utf-8"), bcrypt.gensalt()).decode()
    db.commit()
    return {"ok": True}
