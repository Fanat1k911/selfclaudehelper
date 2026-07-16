"""Раздел «Упаковка»: журнал момента упаковки продукта после производства.
Открыт всем ролям (как «Производство») — worker видит только свои записи,
founder/developer — все (см. таблицу ролей в CLAUDE.md).

Мультитенантность: каждый запрос фильтруется по user["company_id"]."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER

from app.db import get_db
from app.models import PackagingLog, Product
from app.schemas import PackagingRequest
from app.security import get_current_user

router = APIRouter(prefix="/api/packaging", tags=["packaging"], dependencies=[Depends(get_current_user)])


@router.get("/products")
def list_products(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(Product).where(Product.company_id == user["company_id"])
    return [{"id": p.id, "название": p.name} for p in db.scalars(stmt)]


def _log_dict(entry: PackagingLog) -> dict:
    return {
        "id": entry.id,
        "дата": entry.date.isoformat(),
        "worker_id": entry.worker_id,
        "ФИО сотрудника": entry.worker.fio,
        "product_id": entry.product_id,
        "название продукта": entry.product.name,
        "кол-во": float(entry.qty),
        "брак": float(entry.defects),
        "комментарий": entry.comment or "",
    }


@router.get("")
def list_packaging(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(PackagingLog).where(PackagingLog.company_id == user["company_id"]).order_by(PackagingLog.date.desc())
    if user["role"] not in (FOUNDER, DEVELOPER):
        stmt = stmt.where(PackagingLog.worker_id == user["id"])
    return [_log_dict(entry) for entry in db.scalars(stmt)]


@router.post("")
def create_packaging(
    body: PackagingRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    if body.qty <= 0:
        raise HTTPException(400, "Количество должно быть больше нуля.")
    product = db.get(Product, body.product_id)
    if product is None or product.company_id != user["company_id"]:
        raise HTTPException(404, "Продукт не найден.")

    log = PackagingLog(
        company_id=user["company_id"],
        worker_id=user["id"],
        product_id=body.product_id,
        qty=body.qty,
        defects=body.defects,
        comment=body.comment,
    )
    db.add(log)
    db.commit()
    return {"id": log.id}
