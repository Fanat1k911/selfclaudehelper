from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER
from app.db import get_db
from app.models import LoginLog
from app.schemas import LoginRequest, TokenResponse
from app.security import authenticate, create_access_token, get_current_user, require_roles

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate(body.login, body.password, db)
    db.add(LoginLog(company_id=user["company_id"], user_id=user["id"]))
    db.commit()
    token = create_access_token(user)
    return TokenResponse(access_token=token, user=user)


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
