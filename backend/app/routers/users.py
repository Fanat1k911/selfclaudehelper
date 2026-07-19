"""Управление сотрудниками (роадмап-шаг 6) — доступно только founder/developer
(см. таблицу ролей в CLAUDE.md). Увольнение — не DELETE, а смена status на
USER_STATUS_FIRED: security.get_current_user перепроверяет статус на каждый запрос,
так что уволенный теряет доступ сразу же, история (Production/Sales) не рвётся
чужим foreign key. status — глобальный на User (уволен = уволен из всех компаний).

Мультитенантность: список/изменение сотрудников — только внутри своей компании
(через CompanyMembership, см. app/models.py). Логин остаётся глобально уникальным
(не per-company) — см. CLAUDE.md.

Мульти-компанийные пользователи (2026-07-18): если введённый логин уже существует
у другого человека — не ошибка "занято", а приглашение существующего аккаунта в
ТЕКУЩУЮ компанию с ролью из формы (см. `attach_or_create_membership` в security.py —
требует правильный пароль существующего аккаунта, иначе это была бы дыра; ФИО/телефон
и т.п. из формы игнорируются, только пароль подтверждает личность). Тот же принцип
в companies.py и create_founder.py — общий helper, не три копии."""

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.constants import DEVELOPER, FOUNDER, USER_ROLES

from app.db import get_db
from app.models import CompanyMembership, User
from app.schemas import NewUserRequest, ResetPasswordRequest, UpdateUserRequest
from app.security import attach_or_create_membership, get_current_user, require_roles
from app.timezone_utils import is_valid_tz_name

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))])


def _user_dict(user: User, role: str) -> dict:
    return {
        "id": user.id,
        "fio": user.fio,
        "login": user.login,
        "role": role,
        "status": user.status,
        "created_at": user.created_at.isoformat(),
        "phone": user.phone or "",
        "messenger": user.messenger or "",
        "address": user.address or "",
        "document": user.document or "",
        "timezone": user.timezone or "",
    }


def _get_own_membership(db: Session, user_id: str, company_id: str) -> CompanyMembership:
    membership = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.user_id == user_id, CompanyMembership.company_id == company_id
        )
    )
    if membership is None:
        raise HTTPException(404, "Сотрудник не найден.")
    return membership


@router.get("")
def list_users(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    # joinedload(.user) — без него каждый m.user ниже был отдельным SELECT (N+1 на
    # каждое открытие страницы «Сотрудники», растёт с числом сотрудников; code-review 2026-07-18).
    stmt = (
        select(CompanyMembership)
        .where(CompanyMembership.company_id == user["company_id"])
        .options(joinedload(CompanyMembership.user))
    )
    memberships = db.scalars(stmt).all()
    return sorted(
        (_user_dict(m.user, m.role) for m in memberships),
        key=lambda d: d["fio"],
    )


@router.post("")
def create_user(body: NewUserRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if body.role not in USER_ROLES:
        raise HTTPException(400, f"Недопустимая роль. Разрешены: {', '.join(USER_ROLES)}.")
    if not body.login.strip():
        raise HTTPException(400, "Логин обязателен.")

    target_user, attached_existing = attach_or_create_membership(
        db,
        login=body.login,
        company_id=user["company_id"],
        role=body.role,
        password=body.password,
        fio=body.fio,
        phone=body.phone,
        messenger=body.messenger,
        address=body.address,
        document=body.document,
    )
    return {"id": target_user.id, "attached_existing": attached_existing}


@router.patch("/{user_id}")
def update_user(
    user_id: str, body: UpdateUserRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    membership = _get_own_membership(db, user_id, user["company_id"])
    target = membership.user

    if body.role is not None:
        if body.role not in USER_ROLES:
            raise HTTPException(400, f"Недопустимая роль. Разрешены: {', '.join(USER_ROLES)}.")
        membership.role = body.role
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
    if body.timezone is not None:
        if body.timezone and not is_valid_tz_name(body.timezone):
            raise HTTPException(400, "Неизвестный часовой пояс.")
        target.timezone = body.timezone or None

    db.commit()
    return _user_dict(target, membership.role)


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: str, body: ResetPasswordRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    membership = _get_own_membership(db, user_id, user["company_id"])
    target = membership.user
    if not body.new_password:
        raise HTTPException(400, "Пароль не может быть пустым.")

    target.password_hash = bcrypt.hashpw(body.new_password.encode("utf-8"), bcrypt.gensalt()).decode()
    db.commit()
    return {"ok": True}


@router.get("/{user_id}/companies")
def user_companies(
    user_id: str, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    """Все компании этого человека, не только текущая — карточка сотрудника в StaffDetailPanel
    (2026-07-18). Только Developer: Founder не должен узнавать о существовании/составе чужих
    компаний через своего сотрудника (это была бы утечка мимо CompanyMembership-изоляции).
    Сначала проверяем, что user_id вообще состоит в СВОЕЙ компании смотрящего — иначе Developer
    мог бы перебирать произвольные user_id и просматривать чужие тенанты вслепую."""
    if user["role"] != DEVELOPER:
        raise HTTPException(403, "Нет доступа к этому разделу.")
    _get_own_membership(db, user_id, user["company_id"])

    stmt = (
        select(CompanyMembership)
        .where(CompanyMembership.user_id == user_id)
        .options(joinedload(CompanyMembership.company))
    )
    return [
        {"id": m.company_id, "name": m.company.name, "role": m.role} for m in db.scalars(stmt)
    ]
