"""Карточки готовых изделий — доступно только founder/developer (см. таблицу ролей в CLAUDE.md).
Обязательные поля при создании — название/категория/GTIN, см. app.constants.PRODUCT_REQUIRED_FIELDS.
Название рецепта в Product больше не хранится в БД — join при чтении."""

import io
import re
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER, PRODUCT_REQUIRED_FIELDS

from app.db import get_db
from app.models import Product, ProductionLog, Recipe, Sale
from app.schemas import NewProductRequest, ProductImportCommitRequest
from app.security import require_roles

router = APIRouter(prefix="/api/products", tags=["products"], dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))])


def _missing_required_fields(fields: dict[str, str]) -> list[str]:
    return [field for field in PRODUCT_REQUIRED_FIELDS if not fields.get(field, "").strip()]


def _ready_to_ship_by_recipe(db: Session) -> dict[str, float]:
    """Готово к отгрузке = произведено по журналу смен (партии × выход) минус брак,
    минус то, что уже продано (см. CLAUDE.md — пока связь рецепт-продукт всегда 1:1)."""
    produced: dict[str, float] = defaultdict(float)
    for log in db.scalars(select(ProductionLog)):
        produced[log.recipe_id] += float(log.batches) * float(log.recipe.batch_yield) - float(log.defects)
    return produced


def _sold_by_product(db: Session) -> dict[str, float]:
    sold: dict[str, float] = defaultdict(float)
    for sale in db.scalars(select(Sale)):
        sold[sale.product_id] += float(sale.qty)
    return sold


def _product_dict(product: Product, produced_by_recipe: dict[str, float], sold_by_product: dict[str, float]) -> dict:
    ready = None
    if product.recipe_id:
        ready = produced_by_recipe.get(product.recipe_id, 0.0) - sold_by_product.get(product.id, 0.0)
    return {
        "id": product.id,
        "название": product.name,
        "категория": product.category,
        "GTIN": product.gtin,
        "состав": product.composition or "",
        "recipe_id": product.recipe_id or "",
        "название рецепта": product.recipe.name if product.recipe_id and product.recipe else "",
        "ТН ВЭД": product.tn_ved or "",
        "декларация соответствия": product.declaration or "",
        "срок действия РД": product.declaration_expires.isoformat() if product.declaration_expires else "",
        "готово к отгрузке": ready,
    }


@router.get("")
def list_products(db: Session = Depends(get_db)) -> list[dict]:
    produced_by_recipe = _ready_to_ship_by_recipe(db)
    sold_by_product = _sold_by_product(db)
    return [_product_dict(p, produced_by_recipe, sold_by_product) for p in db.scalars(select(Product))]


@router.post("")
def create_product(body: NewProductRequest, db: Session = Depends(get_db)) -> dict:
    fields = {
        "название": body.name,
        "категория": body.category,
        "GTIN": body.gtin,
        "состав": body.composition,
        "recipe_id": body.recipe_id,
        "ТН ВЭД": body.tn_ved,
        "декларация соответствия": body.declaration,
        "срок действия РД": body.declaration_expires,
    }
    missing = _missing_required_fields(fields)
    if missing:
        raise HTTPException(400, f"Не заполнены обязательные поля: {', '.join(missing)}.")

    if body.recipe_id and db.get(Recipe, body.recipe_id) is None:
        raise HTTPException(404, "Рецепт не найден.")

    product = Product(
        name=body.name,
        category=body.category,
        gtin=body.gtin,
        composition=body.composition or None,
        recipe_id=body.recipe_id or None,
        tn_ved=body.tn_ved or None,
        declaration=body.declaration or None,
        declaration_expires=date.fromisoformat(body.declaration_expires) if body.declaration_expires else None,
    )
    db.add(product)
    db.commit()
    return {"id": product.id}


def _find_col(header: list[str], *needles: str) -> int | None:
    return next((i for i, h in enumerate(header) if any(n in h for n in needles)), None)


def _extract_expiry(text: str) -> str:
    """Из свободного текста вида «Выдан\\nDD.MM.YYYY\\nИстекает\\nDD.MM.YYYY» берём
    последнюю дату — считаем её датой окончания действия декларации."""
    dates = re.findall(r"(\d{2})\.(\d{2})\.(\d{4})", text)
    if not dates:
        return ""
    d, m, y = dates[-1]
    return f"{y}-{m}-{d}"


def _cell_to_str(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _load_workbook(content: bytes):
    try:
        return load_workbook(io.BytesIO(content), data_only=True)
    except Exception:
        raise HTTPException(400, "Не удалось прочитать файл. Поддерживается формат .xlsx.")


def _parse_import_file(content: bytes, sheet_name: str | None = None) -> list[dict]:
    wb = _load_workbook(content)
    if sheet_name:
        if sheet_name not in wb.sheetnames:
            raise HTTPException(400, f"В файле нет вкладки «{sheet_name}».")
        ws = wb[sheet_name]
    else:
        ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise HTTPException(400, "Файл пуст.")

    header = [str(c).strip().casefold() if c is not None else "" for c in rows[0]]
    col_name = _find_col(header, "наименование", "название")
    col_category = _find_col(header, "категория")
    col_gtin = _find_col(header, "gtin", "шк")
    col_tnved = _find_col(header, "тн вэд", "тнвэд")
    col_declaration = _find_col(header, "декларац")
    col_expires = _find_col(header, "срок")

    if col_name is None or col_category is None or col_gtin is None:
        raise HTTPException(400, "В файле нет колонок «Наименование», «Категория» и «GTIN».")

    parsed = []
    for row in rows[1:]:
        if row is None or all(c is None for c in row):
            continue
        name = _cell_to_str(row[col_name])
        if not name:
            continue
        expiry_raw = _cell_to_str(row[col_expires]) if col_expires is not None else ""
        parsed.append(
            {
                "name": name,
                "category": _cell_to_str(row[col_category]),
                "gtin": _cell_to_str(row[col_gtin]),
                "tn_ved": _cell_to_str(row[col_tnved]) if col_tnved is not None else "",
                "declaration": _cell_to_str(row[col_declaration]) if col_declaration is not None else "",
                "declaration_expires": _extract_expiry(expiry_raw),
            }
        )
    return parsed


@router.post("/import/sheets")
async def import_sheets(file: UploadFile = File(...)) -> dict:
    content = await file.read()
    wb = _load_workbook(content)
    return {"sheets": wb.sheetnames}


@router.post("/import/preview")
async def import_preview(
    file: UploadFile = File(...), sheet_name: str | None = Form(None), db: Session = Depends(get_db)
) -> list[dict]:
    content = await file.read()
    parsed = _parse_import_file(content, sheet_name)

    existing_gtins = {p.gtin for p in db.scalars(select(Product))}
    seen_gtins: set[str] = set()

    result = []
    for item in parsed:
        row = {**item, "status": "ok"}
        missing = _missing_required_fields(
            {"название": item["name"], "категория": item["category"], "GTIN": item["gtin"]}
        )
        if missing:
            row["status"] = f"не заполнены поля: {', '.join(missing)}"
        elif item["gtin"] in existing_gtins:
            row["status"] = "GTIN уже есть в базе"
        elif item["gtin"] in seen_gtins:
            row["status"] = "дубликат GTIN в файле"
        else:
            seen_gtins.add(item["gtin"])
        result.append(row)
    return result


@router.post("/import/commit")
def import_commit(body: ProductImportCommitRequest, db: Session = Depends(get_db)) -> dict:
    """Строки прилетают уже подтверждённые фронтом после превью — здесь без
    повторного парсинга файла, только создание карточек продукта (импорт только
    создаёт новые продукты, обновление существующих по GTIN не поддерживается)."""
    existing_gtins = {p.gtin for p in db.scalars(select(Product))}
    applied = 0
    for row in body.rows:
        if row.gtin in existing_gtins:
            continue
        product = Product(
            name=row.name,
            category=row.category,
            gtin=row.gtin,
            tn_ved=row.tn_ved or None,
            declaration=row.declaration or None,
            declaration_expires=date.fromisoformat(row.declaration_expires) if row.declaration_expires else None,
        )
        db.add(product)
        existing_gtins.add(row.gtin)
        applied += 1
    db.commit()
    return {"ok": True, "applied": applied}
