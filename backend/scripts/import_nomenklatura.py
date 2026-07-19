"""Разовый сброс и перезаливка справочника «Компоненты» из вкладки «Номенклатура»
(Google Sheet, экспортирована через Drive в markdown-таблицу, см. путь по умолчанию
ниже) — запрос Александра (developer), 2026-07-19.

Что делает (--write):
  1. Удаляет ВСЕ RecipeItems -> Transactions -> Materials текущей компании (в этом
     порядке — иначе упрётся в FK). Рецепты (Recipe) НЕ удаляются, но лишаются
     состава — пересобрать состав рецептов из новой номенклатуры отдельная задача.
  2. Создаёт Material на каждую строку источника + опциональные закупочные поля
     (см. models.py::Material).
  3. Создаёт одну приходную Transaction на материал — открывающий остаток
     кол-во_ед × вес_фасовки, цена = себестоимость за ед. Не объективный факт (это
     сумма исторических приходов из источника, не текущий физический остаток на
     складе), но нужен, чтобы продолжить ручное тестирование проекта, а не начинать
     с нулевых остатков — так решил Александр.

Маппинг колонок источника (тип | наименование | объём г/мл фасовка | объём г
фасовка[не используется] | цена | кол-во ед | стоимость закупки | сс за ед. объёма
| поставщик | INCI):
  category               = тип (косм/тара/свеч — впрямую, без попытки угадать
                            сыпучее/жидкое по названию: 190 незнакомых косметических
                            ингредиентов на глаз надёжно не классифицировать)
  unit                    = "шт" для тара (в источнике объём фасовки всегда "1" —
                            штучный товар), иначе "г"
  unit_cost               = сс за ед. объёма
  min_purchase_batch_weight = объём, г/мл (фасовка)
  min_purchase_batch_qty  = тоже объём, г/мл (фасовка) — отдельной колонки под это
                            в источнике нет, поле дублирует вес до уточнения
  min_purchase_batch_cost = цена, руб.
  supplier / inci         = впрямую, где заполнено (в источнике почти everywhere пусто)

Без --write только печатает план (сколько строк, разбивка по категориям, ошибки
парсинга) — ничего не пишет в БД.

Запуск (локально, на dev):
    cd backend && .venv/bin/python -m scripts.import_nomenklatura \
        --source /path/to/nomenklatura.txt --company-id a0000001 --write

Запуск на проде — тот же скрипт с DATABASE_URL, указывающим на Neon:
    DATABASE_URL=postgresql+psycopg://... .venv/bin/python -m scripts.import_nomenklatura \
        --source /path/to/nomenklatura.txt --company-id a0000001 --write
"""

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.constants import TRANSACTION_INCOME
from app.db import SessionLocal
from app.models import Material, RecipeItem, Transaction

CATEGORY_TARA = "тара"


def _num(raw: str) -> float | None:
    raw = raw.strip().replace("\xa0", "").replace(" ", "")
    if raw == "":
        return None
    raw = raw.replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def parse_rows(text: str) -> list[dict]:
    rows = []
    errors = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 9:
            continue
        category, name, weight, _unused, price, qty, _total, unit_cost, supplier = cells[:9]
        inci = cells[9] if len(cells) > 9 else ""
        name = re.sub(r"\\(.)", r"\1", name).strip()
        if not name or category not in ("косм", "тара", "свеч"):
            continue
        weight_v, price_v, qty_v, unit_cost_v = _num(weight), _num(price), _num(qty), _num(unit_cost)
        if weight_v is None or unit_cost_v is None:
            errors.append(f"строка {lineno}: не распознаны числа ({name!r})")
            continue
        rows.append(
            {
                "category": category,
                "name": name,
                "weight": weight_v,
                "price": price_v,
                "qty": qty_v,
                "unit_cost": unit_cost_v,
                "supplier": supplier or None,
                "inci": inci or None,
            }
        )
    return rows, errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Путь к markdown-выгрузке вкладки «Номенклатура».")
    parser.add_argument("--company-id", required=True)
    parser.add_argument("--write", action="store_true", help="Реально удалить и записать. Без флага — только план.")
    args = parser.parse_args()

    text = Path(args.source).read_text(encoding="utf-8")
    rows, errors = parse_rows(text)

    by_cat: dict[str, int] = {}
    for r in rows:
        by_cat[r["category"]] = by_cat.get(r["category"], 0) + 1

    print(f"Разобрано строк: {len(rows)}")
    for cat, n in sorted(by_cat.items()):
        print(f"  {cat}: {n}")
    if errors:
        print(f"Не распознано ({len(errors)}):")
        for e in errors:
            print(f"  {e}")

    if not args.write:
        print("\nDry-run — ничего не записано. Запусти с --write, чтобы применить.")
        return

    db = SessionLocal()
    try:
        material_ids = [
            m.id for m in db.query(Material.id).filter(Material.company_id == args.company_id)
        ]
        deleted_items = (
            db.query(RecipeItem).filter(RecipeItem.material_id.in_(material_ids)).delete(synchronize_session=False)
            if material_ids
            else 0
        )
        deleted_tx = (
            db.query(Transaction)
            .filter(Transaction.company_id == args.company_id)
            .delete(synchronize_session=False)
        )
        deleted_materials = (
            db.query(Material).filter(Material.company_id == args.company_id).delete(synchronize_session=False)
        )
        print(f"\nУдалено: RecipeItems={deleted_items}, Transactions={deleted_tx}, Materials={deleted_materials}")

        created = 0
        for r in rows:
            unit = "шт" if r["category"] == CATEGORY_TARA else "г"
            material = Material(
                company_id=args.company_id,
                name=r["name"],
                category=r["category"],
                unit=unit,
                min_stock=0,
                unit_cost=r["unit_cost"],
                min_purchase_batch_weight=r["weight"],
                min_purchase_batch_qty=r["weight"],
                min_purchase_batch_cost=r["price"],
                supplier=r["supplier"],
                inci=r["inci"],
            )
            db.add(material)
            db.flush()
            if r["qty"] is not None and r["qty"] > 0:
                db.add(
                    Transaction(
                        company_id=args.company_id,
                        material_id=material.id,
                        type=TRANSACTION_INCOME,
                        qty=r["qty"] * r["weight"],
                        price=r["unit_cost"],
                        comment="импорт номенклатуры 2026-07-19 (не объективный остаток, для теста)",
                    )
                )
            created += 1
        db.commit()
        print(f"Создано материалов: {created}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
