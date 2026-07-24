"""Эндпоинты без авторизации, доступные извне (2026-07-24) — сейчас только один: приём
"звонка домой" от роутера мастерской для ограничения входа worker'ов по сети (см. CLAUDE.md
→ "Ограничение входа worker'ов по сети мастерской", security.py::enforce_workshop_network).

Токен в пути — сам себе авторизация (128 бит случайности, см. users.py::update_network_settings),
поэтому без require_roles/get_current_user, как и POST /api/auth/register (см. auth.py)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Company
from app.rate_limit import client_ip

router = APIRouter(prefix="/api/public", tags=["public"])


@router.post("/workshop-ping/{token}")
def workshop_ping(token: str, request: Request, db: Session = Depends(get_db)) -> dict:
    """Роутер мастерской стучится сюда раз в несколько минут (cron) — запоминаем IP,
    с которого пришёл запрос, как текущий IP мастерской. Молчаливый успех/провал (не
    раскрываем, существует ли токен) — тот же принцип, что и у остальных публичных
    эндпоинтов в проекте, не превращаем в оракул для перебора токенов."""
    company = db.scalar(select(Company).where(Company.worker_network_token == token))
    if not company:
        raise HTTPException(404, "Не найдено.")
    company.worker_network_ip = client_ip(request)
    company.worker_network_ip_updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}
