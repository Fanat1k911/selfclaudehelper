"""Реестр виджетов дашборда-конструктора (роадмап-идея из CLAUDE.md, реализована по
запросу Founder). Каждый виджет — ключ, метаданные для сетки (размер по умолчанию,
минимальный размер, тип отрисовки) и функция compute(db, company_id) -> JSON-
сериализуемые данные. Раскладка (какие виджеты показаны и где) хранится отдельно в
DashboardWidgetLayout — per-user (2026-07-20, было общей на компанию до этого): каждый
настраивает себе сам, независимо от роли; company_id остаётся для мультитенантной
изоляции."""

from collections import defaultdict
from datetime import date as date_

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import TRANSACTION_ADJUSTMENT, TRANSACTION_EXPENSE, TRANSACTION_INCOME
from app.models import Material, PackagingLog, ProductionLog, Sale, Transaction

_SIGN_BY_TYPE = {TRANSACTION_INCOME: 1, TRANSACTION_EXPENSE: -1, TRANSACTION_ADJUSTMENT: 1}


def _balances(db: Session, company_id: str) -> dict[str, float]:
    balances: dict[str, float] = defaultdict(float)
    for tx in db.scalars(select(Transaction).where(Transaction.company_id == company_id)):
        balances[tx.material_id] += float(tx.qty) * _SIGN_BY_TYPE.get(tx.type, 0)
    return balances


def _low_stock(db: Session, company_id: str) -> list[dict]:
    materials = db.scalars(select(Material).where(Material.company_id == company_id)).all()
    balances = _balances(db, company_id)
    rows = [
        {
            "id": m.id,
            "название": m.name,
            "остаток": balances.get(m.id, 0.0),
            "мин.остаток": float(m.min_stock),
            "ед.измерения": m.unit,
        }
        for m in materials
        if balances.get(m.id, 0.0) < float(m.min_stock)
    ]
    rows.sort(key=lambda r: r["остаток"])
    return rows


def _recent_transactions(db: Session, company_id: str) -> list[dict]:
    materials = {m.id: m for m in db.scalars(select(Material).where(Material.company_id == company_id))}
    stmt = select(Transaction).where(Transaction.company_id == company_id).order_by(Transaction.date.desc())
    transactions = db.scalars(stmt).all()[:10]
    return [
        {
            "id": tx.id,
            "дата": tx.date.isoformat(),
            "название": materials[tx.material_id].name if tx.material_id in materials else tx.material_id,
            "ед.измерения": materials[tx.material_id].unit if tx.material_id in materials else "",
            "тип": tx.type,
            "кол-во": float(tx.qty),
            "цена": float(tx.price) if tx.price is not None else "",
            "комментарий": tx.comment or "",
        }
        for tx in transactions
    ]


def _spend_totals(db: Session, company_id: str) -> tuple[dict[str, float], dict[str, float], dict[str, str]]:
    stmt = select(Transaction).where(
        Transaction.company_id == company_id, Transaction.type == TRANSACTION_INCOME, Transaction.price.is_not(None)
    )
    name_by_id = {m.id: m.name for m in db.scalars(select(Material).where(Material.company_id == company_id))}

    by_month: dict[str, float] = defaultdict(float)
    by_material: dict[str, float] = defaultdict(float)
    for tx in db.scalars(stmt):
        amount = float(tx.qty) * float(tx.price)
        by_month[tx.date.strftime("%Y-%m")] += amount
        by_material[tx.material_id] += amount
    return by_month, by_material, name_by_id


def _monthly_spend(db: Session, company_id: str) -> list[dict]:
    by_month, _, _ = _spend_totals(db, company_id)
    return [{"месяц": month, "сумма": round(v, 2)} for month, v in sorted(by_month.items())]


def _top_expense_materials(db: Session, company_id: str) -> list[dict]:
    _, by_material, name_by_id = _spend_totals(db, company_id)
    top = sorted(by_material.items(), key=lambda kv: kv[1], reverse=True)[:5]
    return [{"material_id": mid, "название": name_by_id.get(mid, mid), "сумма": round(v, 2)} for mid, v in top]


def _kpi_by_worker(db: Session, company_id: str) -> list[dict]:
    totals: dict[tuple[str, str], dict] = {}
    stmt = select(ProductionLog).where(ProductionLog.company_id == company_id)
    for entry in db.scalars(stmt):
        month = entry.date.strftime("%Y-%m")
        key = (month, entry.worker_id)
        row = totals.setdefault(key, {"месяц": month, "ФИО": entry.worker.fio, "произведено": 0.0})
        row["произведено"] += float(entry.qty) - float(entry.defects)
    result = list(totals.values())
    result.sort(key=lambda r: (r["месяц"], r["ФИО"]))
    return result


def _top_products(db: Session, company_id: str, limit: int = 3) -> list[dict]:
    totals: dict[str, float] = defaultdict(float)
    names: dict[str, str] = {}
    for s in db.scalars(select(Sale).where(Sale.company_id == company_id)):
        totals[s.product_id] += float(s.qty)
        if s.product:
            names[s.product_id] = s.product.name
    top = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [{"product_id": pid, "название": names.get(pid, pid), "кол-во": qty} for pid, qty in top]


def _production_leaderboard(db: Session, company_id: str) -> list[dict]:
    today = date_.today()
    month_start = today.replace(day=1)
    stmt = select(ProductionLog).where(ProductionLog.company_id == company_id, ProductionLog.date >= month_start)
    entries = db.scalars(stmt)
    totals: dict[str, dict] = {}
    for entry in entries:
        row = totals.setdefault(
            entry.worker_id, {"worker_id": entry.worker_id, "ФИО": entry.worker.fio, "сегодня": 0.0, "месяц": 0.0}
        )
        qty = float(entry.qty) - float(entry.defects)
        row["месяц"] += qty
        if entry.date == today:
            row["сегодня"] += qty
    result = list(totals.values())
    result.sort(key=lambda r: r["месяц"], reverse=True)
    return result


def _monthly_revenue(db: Session, company_id: str) -> list[dict]:
    """Выручка = кол-во×цена по Sales с заполненной ценой, помесячно."""
    by_month: dict[str, float] = defaultdict(float)
    stmt = select(Sale).where(Sale.company_id == company_id, Sale.price.is_not(None))
    for s in db.scalars(stmt):
        by_month[s.date.strftime("%Y-%m")] += float(s.qty) * float(s.price)
    return [{"месяц": m, "выручка": round(v, 2)} for m, v in sorted(by_month.items())]


def _top_counterparties(db: Session, company_id: str, limit: int = 5) -> list[dict]:
    """Топ контрагентов по выручке. Продажи без привязки к контрагенту не учитываются —
    ранжировать анонимную отгрузку не по чему (общая выручка есть в monthly_revenue)."""
    totals: dict[str, float] = defaultdict(float)
    names: dict[str, str] = {}
    stmt = select(Sale).where(
        Sale.company_id == company_id, Sale.price.is_not(None), Sale.counterparty_id.is_not(None)
    )
    for s in db.scalars(stmt):
        totals[s.counterparty_id] += float(s.qty) * float(s.price)
        if s.counterparty:
            names[s.counterparty_id] = s.counterparty.name
    top = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [{"counterparty_id": cid, "название": names.get(cid, cid), "выручка": round(v, 2)} for cid, v in top]


def _defect_rate(db: Session, company_id: str) -> list[dict]:
    """% брака от выпуска (брак / (партии×выход_партии)), помесячно."""
    produced: dict[str, float] = defaultdict(float)
    defects: dict[str, float] = defaultdict(float)
    stmt = select(ProductionLog).where(ProductionLog.company_id == company_id)
    for entry in db.scalars(stmt):
        month = entry.date.strftime("%Y-%m")
        produced[month] += float(entry.qty)
        defects[month] += float(entry.defects)
    result = []
    for month in sorted(produced):
        total = produced[month]
        rate = round(defects[month] / total * 100, 2) if total > 0 else 0.0
        result.append({"месяц": month, "брак_процент": rate})
    return result


def _stock_by_category(db: Session, company_id: str) -> list[dict]:
    materials = db.scalars(select(Material).where(Material.company_id == company_id)).all()
    balances = _balances(db, company_id)
    by_category: dict[str, float] = defaultdict(float)
    for m in materials:
        by_category[m.category] += max(balances.get(m.id, 0.0), 0.0)
    return [{"категория": cat, "остаток": round(v, 2)} for cat, v in sorted(by_category.items())]


def _recent_events(db: Session, company_id: str, limit: int = 5) -> list[dict]:
    """5 последних событий по всей системе (2026-07-19, запрос Founder) — движения
    компонентов, производство, упаковка, продажи, смёрженные по времени. Каждый
    источник запрошен уже отсортированным и обрезанным до `limit` — топ-5 общий
    не может содержать строку, не попавшую в топ-5 своего источника, так что дальше
    смёрживать нужно не более 4×limit кандидатов, а не сканировать всё целиком."""
    name_by_material = {m.id: m.name for m in db.scalars(select(Material).where(Material.company_id == company_id))}
    events: list[dict] = []

    tx_stmt = (
        select(Transaction)
        .where(Transaction.company_id == company_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
    )
    for tx in db.scalars(tx_stmt):
        events.append(
            {
                "время": tx.created_at,
                "тип": tx.type,
                "текст": f"{tx.type.capitalize()}: {name_by_material.get(tx.material_id, tx.material_id)}, {float(tx.qty)}",
            }
        )

    prod_stmt = (
        select(ProductionLog)
        .where(ProductionLog.company_id == company_id)
        .order_by(ProductionLog.finished_at.desc())
        .limit(limit)
    )
    for entry in db.scalars(prod_stmt):
        events.append(
            {
                "время": entry.finished_at,
                "тип": "производство",
                "текст": f"Производство: {entry.recipe.name} — {entry.worker.fio}",
            }
        )

    pack_stmt = (
        select(PackagingLog)
        .where(PackagingLog.company_id == company_id)
        .order_by(PackagingLog.created_at.desc())
        .limit(limit)
    )
    for entry in db.scalars(pack_stmt):
        events.append(
            {
                "время": entry.created_at,
                "тип": "упаковка",
                "текст": f"Упаковка: {entry.product.name} — {entry.worker.fio}",
            }
        )

    sale_stmt = (
        select(Sale).where(Sale.company_id == company_id).order_by(Sale.created_at.desc()).limit(limit)
    )
    for s in db.scalars(sale_stmt):
        events.append(
            {
                "время": s.created_at,
                "тип": "продажа",
                "текст": f"Продажа: {s.product.name} × {float(s.qty)}",
            }
        )

    events.sort(key=lambda e: e["время"], reverse=True)
    top = events[:limit]
    for e in top:
        e["время"] = e["время"].isoformat()
    return top


WIDGET_CATALOG: list[dict] = [
    {"key": "low_stock", "title": "Остатки ниже минимума", "kind": "list",
     "w": 4, "h": 5, "min_w": 3, "min_h": 4, "compute": _low_stock},
    {"key": "recent_transactions", "title": "Последние движения компонентов", "kind": "list",
     "w": 8, "h": 6, "min_w": 6, "min_h": 4, "compute": _recent_transactions},
    {"key": "top_expense_materials", "title": "Топ-5 компонентов по тратам", "kind": "bar",
     "w": 6, "h": 6, "min_w": 4, "min_h": 4, "compute": _top_expense_materials},
    {"key": "monthly_spend", "title": "Траты по месяцам", "kind": "line",
     "w": 8, "h": 6, "min_w": 6, "min_h": 4, "compute": _monthly_spend},
    {"key": "kpi_by_worker", "title": "КПД по сотрудникам", "kind": "bar",
     "w": 8, "h": 6, "min_w": 6, "min_h": 4, "compute": _kpi_by_worker},
    {"key": "top_products", "title": "Топ-3 продукта по продажам", "kind": "list",
     "w": 4, "h": 5, "min_w": 3, "min_h": 4, "compute": _top_products},
    {"key": "production_leaderboard", "title": "Лидерборд производства", "kind": "list",
     "w": 4, "h": 5, "min_w": 3, "min_h": 4, "compute": _production_leaderboard},
    {"key": "monthly_revenue", "title": "Выручка по месяцам", "kind": "line",
     "w": 8, "h": 6, "min_w": 6, "min_h": 4, "compute": _monthly_revenue},
    {"key": "top_counterparties", "title": "Топ контрагентов по выручке", "kind": "bar",
     "w": 6, "h": 6, "min_w": 4, "min_h": 4, "compute": _top_counterparties},
    {"key": "defect_rate", "title": "Брак, % от выпуска", "kind": "stat",
     "w": 4, "h": 4, "min_w": 3, "min_h": 3, "compute": _defect_rate},
    {"key": "stock_by_category", "title": "Остатки по категориям компонентов", "kind": "donut",
     "w": 6, "h": 6, "min_w": 4, "min_h": 4, "compute": _stock_by_category},
    {"key": "recent_events", "title": "5 последних событий", "kind": "list",
     "w": 6, "h": 6, "min_w": 4, "min_h": 4, "compute": _recent_events},
]

WIDGET_BY_KEY = {w["key"]: w for w in WIDGET_CATALOG}
