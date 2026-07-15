from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import LoginRequest, TokenResponse
from app.security import authenticate, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate(body.login, body.password, db)
    token = create_access_token(user)
    return TokenResponse(access_token=token, user=user)


@router.get("/me")
def me(user: dict = Depends(get_current_user)) -> dict:
    return user
