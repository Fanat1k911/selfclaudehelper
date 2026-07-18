from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER
from app.db import get_db
from app.models import LoginLog
from app.schemas import LoginRequest, SelectCompanyRequest, SwitchCompanyRequest
from app.security import authenticate, create_access_token, get_current_user, require_roles, select_company, switch_company

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _finalize(result: dict, db: Session) -> dict:
    """authenticate()/select_company() уже отдали публичные поля юзера — минтим токен
    и пишем LoginLog. Общий хвост для однокомпанийного входа и второго шага выбора."""
    user = result["user"]
    db.add(LoginLog(company_id=user["company_id"], user_id=user["id"]))
    db.commit()
    token = create_access_token(user)
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)) -> dict:
    result = authenticate(body.login, body.password, db)
    if result["status"] == "choose_company":
        # Несколько компаний у одного логина (2026-07-18) — не логиним сразу, фронт
        # показывает выбор компании и достучится через /select-company с pending_token.
        return {"needs_company_choice": True, "pending_token": result["pending_token"], "companies": result["companies"]}
    return _finalize(result, db)


@router.post("/select-company")
def select_company_route(body: SelectCompanyRequest, db: Session = Depends(get_db)) -> dict:
    result = select_company(body.pending_token, body.company_id, db)
    return _finalize(result, db)


@router.post("/switch-company")
def switch_company_route(
    body: SwitchCompanyRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """Смена активной компании уже залогиненным пользователем — без повторного пароля,
    просто переиздаёт токен на другое его же членство (см. app/security.py::switch_company).
    Тоже пишет LoginLog (той компании, куда переключились) — иначе Founder/Developer той
    компании не видел бы в истории входов доступ через переключалку, только через прямой
    логин (нашёл code-review 2026-07-18)."""
    new_user = switch_company(user["id"], body.company_id, db)
    db.add(LoginLog(company_id=new_user["company_id"], user_id=new_user["id"]))
    db.commit()
    token = create_access_token(new_user)
    return {"access_token": token, "token_type": "bearer", "user": new_user}


@router.get("/me")
def me(user: dict = Depends(get_current_user)) -> dict:
    return user


@router.get("/log", dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))])
def login_log(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    stmt = (
        select(LoginLog)
        .where(LoginLog.company_id == user["company_id"])
        .order_by(LoginLog.logged_in_at.desc())
        .limit(200)
    )
    return [
        {
            "id": entry.id,
            "user_id": entry.user_id,
            "ФИО": entry.user.fio,
            "логин": entry.user.login,
            # logged_in_at хранится как datetime.utcnow() без tzinfo — явно помечаем "Z",
            # иначе браузер трактует naive ISO-строку как локальное время и сдвигает дату.
            "дата и время": entry.logged_in_at.isoformat() + "Z",
        }
        for entry in db.scalars(stmt)
    ]
