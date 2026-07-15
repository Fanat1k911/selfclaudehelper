import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.constants import USER_STATUS_ACTIVE
from app.db import Base, get_db
from app.main import app
from app.models import User
from app.security import create_access_token


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_user(db_session, *, login, role, fio="Тест Тестов", password="pass1234", status=USER_STATUS_ACTIVE):
    user = User(
        fio=fio,
        login=login,
        password_hash=bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode(),
        role=role,
        status=status,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def auth_headers(user: User) -> dict:
    token = create_access_token({"id": user.id, "fio": user.fio, "login": user.login, "role": user.role})
    return {"Authorization": f"Bearer {token}"}
