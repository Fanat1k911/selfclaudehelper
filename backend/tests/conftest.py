import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import techlog
from app.constants import USER_STATUS_ACTIVE
from app.db import Base, get_db
from app.main import app
from app.models import Company, CompanyMembership, User
from app.security import create_access_token


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = session_factory()
    # techlog.py открывает свои собственные сессии (пишет из логов вне HTTP-запроса,
    # get_db-переопределение его не касается) — без этого запись логов в тестах била
    # бы в настоящий Postgres из DATABASE_URL, а не в тестовую SQLite.
    original_session_local = techlog.SessionLocal
    techlog.SessionLocal = session_factory
    try:
        yield session
    finally:
        techlog.SessionLocal = original_session_local
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_company(db_session, *, name="Test Company") -> Company:
    company = Company(name=name)
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)
    return company


def _default_company(db_session) -> Company:
    company = db_session.query(Company).filter_by(name="Test Company").first()
    return company or make_company(db_session)


def default_company_id(db_session) -> str:
    """Для тестов, что создают Material/Recipe/... напрямую через ORM (не через API) —
    та же компания по умолчанию, что make_user() создаёт при первом вызове в тесте."""
    return _default_company(db_session).id


def make_user(
    db_session, *, login, role, fio="Тест Тестов", password="pass1234", status=USER_STATUS_ACTIVE, company_id=None
):
    """Создаёт User + одно CompanyMembership (2026-07-18, см. app/models.py — company_id/role
    больше не живут прямо на User). .role/.company_id остаются доступны на возвращённом
    объекте как обычные атрибуты — прицеплены вручную ниже, чтобы не переписывать все
    вызовы make_user(...).role по всем тестам, хотя в реальной модели это membership.role."""
    if company_id is None:
        company_id = _default_company(db_session).id
    user = User(
        fio=fio,
        login=login,
        password_hash=bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode(),
        status=status,
    )
    db_session.add(user)
    db_session.flush()
    membership = CompanyMembership(user_id=user.id, company_id=company_id, role=role)
    db_session.add(membership)
    db_session.commit()
    db_session.refresh(user)
    user.role = role
    user.company_id = company_id
    return user


def add_membership(db_session, user: User, *, company_id, role):
    """Второе (третье, ...) членство того же человека — мульти-компанийные пользователи."""
    membership = CompanyMembership(user_id=user.id, company_id=company_id, role=role)
    db_session.add(membership)
    db_session.commit()
    return membership


def auth_headers(user: User, *, company_id=None, role=None) -> dict:
    """По умолчанию — компания/роль из последнего make_user(...) (see .role/.company_id
    attached там же). Передай company_id/role явно, чтобы получить токен на ДРУГОЕ
    членство того же мульти-компанийного пользователя (см. add_membership)."""
    cid = company_id or user.company_id
    r = role or user.role
    membership = next((m for m in user.memberships if m.company_id == cid), None)
    if membership is None:
        raise ValueError(f"user {user.id} has no membership in company {cid}")
    token = create_access_token(
        {
            "id": user.id, "fio": user.fio, "login": user.login, "role": r,
            "company_id": cid, "company_name": membership.company.name,
        }
    )
    return {"Authorization": f"Bearer {token}"}
