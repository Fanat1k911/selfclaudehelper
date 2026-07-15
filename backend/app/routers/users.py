"""Управление сотрудниками (роадмап-шаг 6) — доступно только founder/developer
(см. таблицу ролей в CLAUDE.md). Увольнение — не DELETE, а смена status на
USER_STATUS_FIRED: security.get_current_user перепроверяет статус на каждый запрос,
так что уволенный теряет доступ сразу же, история (Production/Sales) не рвётся
чужим foreign key."""

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER, USER_ROLES, USER_STATUS_ACTIVE

from app.db import get_db
from app.models import User
from app.schemas import NewUserRequest, ResetPasswordRequest, UpdateUserRequest
from app.security import require_roles

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


@router.get("")
def list_users(db: Session = Depends(get_db)) -> list[dict]:
    return [_user_dict(u) for u in db.scalars(select(User).order_by(User.fio))]


@router.post("")
def create_user(body: NewUserRequest, db: Session = Depends(get_db)) -> dict:
    if body.role not in USER_ROLES:
        raise HTTPException(400, f"Недопустимая роль. Разрешены: {', '.join(USER_ROLES)}.")
    if not body.fio.strip() or not body.login.strip() or not body.password:
        raise HTTPException(400, "ФИО, логин и пароль обязательны.")

    existing = db.scalar(select(User).where(User.login.ilike(body.login.strip())))
    if existing:
        raise HTTPException(400, "Такой логин уже занят.")

    user = User(
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
    db.add(user)
    db.commit()
    return {"id": user.id}


@router.patch("/{user_id}")
def update_user(user_id: str, body: UpdateUserRequest, db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "Сотрудник не найден.")

    if body.role is not None:
        if body.role not in USER_ROLES:
            raise HTTPException(400, f"Недопустимая роль. Разрешены: {', '.join(USER_ROLES)}.")
        user.role = body.role
    if body.status is not None:
        user.status = body.status
    if body.fio is not None:
        user.fio = body.fio.strip()
    if body.phone is not None:
        user.phone = body.phone or None
    if body.messenger is not None:
        user.messenger = body.messenger or None
    if body.address is not None:
        user.address = body.address or None
    if body.document is not None:
        user.document = body.document or None

    db.commit()
    return _user_dict(user)


@router.post("/{user_id}/reset-password")
def reset_password(user_id: str, body: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "Сотрудник не найден.")
    if not body.new_password:
        raise HTTPException(400, "Пароль не может быть пустым.")

    user.password_hash = bcrypt.hashpw(body.new_password.encode("utf-8"), bcrypt.gensalt()).decode()
    db.commit()
    return {"ok": True}
