"""Раздел «Ингредиенты» — Materials/Transactions в Postgres (было: Sheets/pandas,
см. core/inventory.py). Остаток по-прежнему нигде не хранится статично — считается
на лету из Transaction по каждому material_id (см. CLAUDE.md)."""

import io
from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import TRANSACTION_ADJUSTMENT, TRANSACTION_EXPENSE, TRANSACTION_INCOME

from app.db import get_db
from app.models import Material, Transaction
from app.schemas import AdjustmentRequest, ImportCommitRequest, NewMaterialRequest, TransactionRequest
from app.security import get_current_user

router = APIRouter(prefix="/api/ingredients", tags=["ingredients"], dependencies=[Depends(get_current_user)])

_SIGN_BY_TYPE = {TRANSACTION_INCOME: 1, TRANSACTION_EXPENSE: -1, TRANSACTION_ADJUSTMENT: 1}
_YELLOW_MULTIPLIER = 1.2


def _color(balance: float, min_stock: float) -> str:
    """Жёлтая зона существует только при min_stock > 0 — иначе интервал пуст."""
    if balance < min_stock:
        return "красный"
    if min_stock > 0 and balance <= min_stock * _YELLOW_MULTIPLIER:
        return "жёлтый"
    return "зелёный"


def _material_dict(material: Material, balance: float, last_movement: date | None) -> dict:
    min_stock = float(material.min_stock)
    return {
        "id": material.id,
        "название": material.name,
        "категория": material.category,
        "ед.измерения": material.unit,
        "мин.остаток": min_stock,
        "остаток": balance,
        "ниже минимума": balance < min_stock,
        "цвет": _color(balance, min_stock),
        "последнее движение": last_movement.isoformat() if last_movement else None,
    }


def _transaction_dict(tx: Transaction) -> dict:
    return {
        "id": tx.id,
        "дата": tx.date.isoformat(),
        "material_id": tx.material_id,
        "тип": tx.type,
        "кол-во": float(tx.qty),
        "цена": float(tx.price) if tx.price is not None else "",
        "recipe_id": tx.recipe_id or "",
        "комментарий": tx.comment or "",
    }


def _balances_and_last_movement(db: Session) -> tuple[dict[str, float], dict[str, date]]:
    balances: dict[str, float] = {}
    last_movement: dict[str, date] = {}
    for tx in db.scalars(select(Transaction)):
        sign = _SIGN_BY_TYPE.get(tx.type, 0)
        balances[tx.material_id] = balances.get(tx.material_id, 0.0) + float(tx.qty) * sign
        if tx.material_id not in last_movement or tx.date > last_movement[tx.material_id]:
            last_movement[tx.material_id] = tx.date
    return balances, last_movement


@router.get("")
def list_ingredients(db: Session = Depends(get_db)) -> list[dict]:
    materials = db.scalars(select(Material)).all()
    balances, last_movement = _balances_and_last_movement(db)
    return [_material_dict(m, balances.get(m.id, 0.0), last_movement.get(m.id)) for m in materials]


@router.get("/{material_id}/transactions")
def list_transactions(material_id: str, db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(Transaction).where(Transaction.material_id == material_id).order_by(Transaction.date.desc())
    )
    return [_transaction_dict(tx) for tx in rows]


@router.post("")
def create_ingredient(body: NewMaterialRequest, db: Session = Depends(get_db)) -> dict:
    material = Material(name=body.name, category=body.category, unit=body.unit, min_stock=body.min_stock)
    db.add(material)
    db.flush()
    if body.initial_qty > 0:
        db.add(Transaction(material_id=material.id, type=TRANSACTION_INCOME, qty=body.initial_qty, comment="начальный остаток"))
    db.commit()
    return {"id": material.id}


def _require_positive(qty: float) -> None:
    if qty <= 0:
        raise HTTPException(400, "Количество должно быть больше нуля.")


@router.post("/{material_id}/income")
def add_income(material_id: str, body: TransactionRequest, db: Session = Depends(get_db)) -> dict:
    _require_positive(body.qty)
    db.add(Transaction(material_id=material_id, type=TRANSACTION_INCOME, qty=body.qty, price=body.price, comment=body.comment))
    db.commit()
    return {"ok": True}


@router.post("/{material_id}/expense")
def add_expense(material_id: str, body: TransactionRequest, db: Session = Depends(get_db)) -> dict:
    _require_positive(body.qty)
    db.add(Transaction(material_id=material_id, type=TRANSACTION_EXPENSE, qty=body.qty, comment=body.comment))
    db.commit()
    return {"ok": True}


@router.post("/{material_id}/adjustment")
def add_adjustment(material_id: str, body: AdjustmentRequest, db: Session = Depends(get_db)) -> dict:
    material = db.get(Material, material_id)
    if material is None:
        raise HTTPException(404, "Ингредиент не найден.")
    balances, _ = _balances_and_last_movement(db)
    current = balances.get(material_id, 0.0)
    delta = body.actual_qty - current
    if delta == 0:
        return {"ok": True, "delta": 0}
    db.add(
        Transaction(
            material_id=material_id, type=TRANSACTION_ADJUSTMENT, qty=delta, comment=body.comment or "инвентаризация"
        )
    )
    db.commit()
    return {"ok": True, "delta": delta}


@router.get("/export-template")
def export_template(db: Session = Depends(get_db)) -> StreamingResponse:
    """Шаблон для массовой инвентаризации: те же названия, что видит Founder на
    экране, плюс пустая колонка «Новый остаток» — заполняется руками и грузится
    обратно через /import/preview."""
    materials = db.scalars(select(Material)).all()
    balances, _ = _balances_and_last_movement(db)

    wb = Workbook()
    ws = wb.active
    ws.title = "Ингредиенты"
    ws.append(["Название", "Категория", "Ед.измерения", "Текущий остаток", "Новый остаток"])
    for m in materials:
        ws.append([m.name, m.category, m.unit, balances.get(m.id, 0.0), None])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    # Content-Disposition — только latin-1, кириллицу передаём через filename* (RFC 5987).
    filename_utf8 = quote("ингредиенты.xlsx")
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=\"ingredients.xlsx\"; filename*=UTF-8''{filename_utf8}"},
    )


@router.get("/export")
def export_ingredients(db: Session = Depends(get_db)) -> StreamingResponse:
    """Экспорт для просмотра/пересылки (например, в Google Таблицы) — без
    служебной колонки «Новый остаток» из /export-template."""
    materials = db.scalars(select(Material)).all()
    balances, last_movement = _balances_and_last_movement(db)

    wb = Workbook()
    ws = wb.active
    ws.title = "Ингредиенты"
    ws.append(["Название", "Категория", "Ед.измерения", "Остаток", "Мин.остаток", "Обновлено"])
    for m in materials:
        lm = last_movement.get(m.id)
        ws.append([m.name, m.category, m.unit, balances.get(m.id, 0.0), float(m.min_stock), lm.isoformat() if lm else None])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename_utf8 = quote("ингредиенты.xlsx")
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=\"ingredients.xlsx\"; filename*=UTF-8''{filename_utf8}"},
    )


def _parse_import_file(content: bytes) -> list[dict]:
    try:
        wb = load_workbook(io.BytesIO(content), data_only=True)
    except Exception:
        raise HTTPException(400, "Не удалось прочитать файл. Поддерживается формат .xlsx.")
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise HTTPException(400, "Файл пуст.")

    header = [str(c).strip().casefold() if c is not None else "" for c in rows[0]]
    col_name = next((i for i, h in enumerate(header) if h == "название"), None)
    col_new = next((i for i, h in enumerate(header) if h == "новый остаток"), None)
    if col_new is None:
        col_new = next((i for i, h in enumerate(header) if h == "остаток"), None)
    if col_name is None or col_new is None:
        raise HTTPException(400, "В файле нет колонок «Название» и «Новый остаток» (или «Остаток»).")

    parsed = []
    for row in rows[1:]:
        if row is None or all(c is None for c in row):
            continue
        name = row[col_name]
        if name is None or str(name).strip() == "":
            continue
        parsed.append({"name": str(name).strip(), "new_qty": row[col_new]})
    return parsed


@router.post("/import/preview")
async def import_preview(file: UploadFile = File(...), db: Session = Depends(get_db)) -> list[dict]:
    content = await file.read()
    parsed = _parse_import_file(content)

    materials = db.scalars(select(Material)).all()
    by_name: dict[str, list[Material]] = {}
    for m in materials:
        by_name.setdefault(m.name.strip().casefold(), []).append(m)
    balances, _ = _balances_and_last_movement(db)

    result = []
    for item in parsed:
        matches = by_name.get(item["name"].casefold(), [])
        new_qty = item["new_qty"]
        row = {
            "name": item["name"],
            "material_id": None,
            "current_qty": None,
            "new_qty": None,
            "delta": None,
            "status": "",
        }
        if len(matches) == 0:
            row["status"] = "не найден"
        elif len(matches) > 1:
            row["status"] = "неоднозначное совпадение"
        elif not isinstance(new_qty, (int, float)):
            row["status"] = "не число"
        else:
            m = matches[0]
            current = balances.get(m.id, 0.0)
            row.update(
                material_id=m.id,
                current_qty=current,
                new_qty=float(new_qty),
                delta=float(new_qty) - current,
                status="ok",
            )
        result.append(row)
    return result


@router.post("/import/commit")
def import_commit(body: ImportCommitRequest, db: Session = Depends(get_db)) -> dict:
    """Строки прилетают уже подтверждённые фронтом после превью — здесь без
    повторного парсинга файла, только запись движений."""
    balances, _ = _balances_and_last_movement(db)
    applied = 0
    for row in body.rows:
        current = balances.get(row.material_id, 0.0)
        delta = row.new_qty - current
        if delta == 0:
            continue
        db.add(
            Transaction(
                material_id=row.material_id,
                type=TRANSACTION_ADJUSTMENT,
                qty=delta,
                comment=body.comment or "импорт из файла",
            )
        )
        balances[row.material_id] = row.new_qty
        applied += 1
    db.commit()
    return {"ok": True, "applied": applied}
