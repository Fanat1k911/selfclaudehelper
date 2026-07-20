"""SQLAlchemy-модели — замена dict-строк Sheets (см. CLAUDE.md → "Структура данных").

Денормализованные "название рецепта"/"название материала"/"ФИО сотрудника" из
RecipeItems/Products/ProductionLog в Sheets убраны: они существовали только чтобы
Founder мог читать сырой лист глазами, а таблицу больше не будут трогать руками.

Мультитенантность (2026-07-16, см. CLAUDE.md): company_id почти на каждой таблице —
изоляция данных между независимыми клиентами (мастерскими). RecipeItem — исключение,
не хранит company_id напрямую (скоуп идёт транзитивно через recipe_id/material_id,
оба уже company-scoped, и оба проверяются на принадлежность компании в роутере при
создании/изменении состава)."""

import uuid
from datetime import date as date_, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _short_id() -> str:
    return uuid.uuid4().hex[:8]


class Company(Base):
    """Тенант — одна изолированная мастерская/клиент. Первая компания (существующая
    мастерская Founder) создаётся бэкфилл-миграцией при переходе на мультитенантность."""

    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # IANA-имя (2026-07-18, "разлогин ровно в полночь по часовому поясу") — компания,
    # не пользователь: все founder/worker этой компании по умолчанию на одном поясе
    # (физическая мастерская в одном месте). См. User.timezone для личного переопределения.
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Moscow")


class User(Base):
    """Личность человека — НЕ привязана к одной компании (2026-07-18, см. CLAUDE.md →
    "Мульти-компанийные пользователи"). company_id/role раньше жили прямо здесь; теперь
    живут в CompanyMembership — один человек может состоять сразу в нескольких компаниях
    с разной ролью в каждой (напр. Developer одновременно в двух мастерских).
    status — по-прежнему глобальный (уволен = уволен из всех компаний сразу, не по одной)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    fio: Mapped[str] = mapped_column(String(255))
    # Логин глобально уникален (не per-company) — при входе компания определяется
    # по членству, не по самому логину. Если членств больше одного — экран входа
    # спрашивает "какая компания" (см. app/security.py::authenticate).
    login: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    phone: Mapped[str | None] = mapped_column(String(50))
    messenger: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(Text)
    document: Mapped[str | None] = mapped_column(Text)
    # Личное переопределение часового пояса компании (2026-07-18) — пусто по умолчанию,
    # тогда действует Company.timezone; заполняется, если у конкретного человека
    # физически другой пояс (не как у остальной компании).
    timezone: Mapped[str | None] = mapped_column(String(64))

    memberships: Mapped[list["CompanyMembership"]] = relationship()


class CompanyMembership(Base):
    """Один человек ↔ одна компания ↔ одна роль в ней. Замена прямых User.company_id/
    User.role (2026-07-18) — позволяет одному аккаунту (напр. Developer, обслуживающий
    несколько мастерских) состоять сразу в нескольких компаниях с разной ролью в каждой."""

    __tablename__ = "company_memberships"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    role: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped["Company"] = relationship()
    user: Mapped["User"] = relationship(overlaps="memberships")

    __table_args__ = (UniqueConstraint("user_id", "company_id", name="uq_user_company"),)


class LoginLog(Base):
    __tablename__ = "login_log"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    logged_in_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship()


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(20))
    unit: Mapped[str] = mapped_column(String(20))
    min_stock: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    # Карточка компонента (2026-07-19, запрос Founder/Александра) — закупочные атрибуты
    # из каталога поставщика, не связаны с остатком/движениями (те по-прежнему только в
    # Transactions). Все опциональны — не у каждого материала есть все эти данные.
    unit_cost: Mapped[float | None] = mapped_column(Numeric(12, 4))
    min_purchase_batch_qty: Mapped[float | None] = mapped_column(Numeric(12, 3))
    min_purchase_batch_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    min_purchase_batch_weight: Mapped[float | None] = mapped_column(Numeric(12, 3))
    supplier: Mapped[str | None] = mapped_column(String(255))
    inci: Mapped[str | None] = mapped_column(Text)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="material")


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(100))
    produces: Mapped[str] = mapped_column(String(255))
    batch_yield: Mapped[float] = mapped_column(Numeric(12, 3))
    technology: Mapped[str | None] = mapped_column(Text)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    items: Mapped[list["RecipeItem"]] = relationship(back_populates="recipe", cascade="all, delete-orphan")


class RecipeItem(Base):
    __tablename__ = "recipe_items"
    __table_args__ = (UniqueConstraint("recipe_id", "material_id", name="uq_recipe_item"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    recipe_id: Mapped[str] = mapped_column(ForeignKey("recipes.id"))
    material_id: Mapped[str] = mapped_column(ForeignKey("materials.id"))
    qty_per_batch: Mapped[float] = mapped_column(Numeric(12, 3))

    recipe: Mapped["Recipe"] = relationship(back_populates="items")
    material: Mapped["Material"] = relationship()


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    date: Mapped[date_] = mapped_column(Date, default=date_.today)
    material_id: Mapped[str] = mapped_column(ForeignKey("materials.id"))
    type: Mapped[str] = mapped_column(String(20))
    qty: Mapped[float] = mapped_column(Numeric(12, 3))
    price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    recipe_id: Mapped[str | None] = mapped_column(ForeignKey("recipes.id"))
    comment: Mapped[str | None] = mapped_column(Text)
    # created_at (2026-07-19) — отдельно от date (день без времени, вводится руками):
    # нужен для сортировки "последние события" на дашборде с точностью до секунды.
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    material: Mapped["Material"] = relationship(back_populates="transactions")


class EquipmentItem(Base):
    """Рабочий инвентарь (2026-07-19, запрос Александра) — многоразовое оборудование
    мастерской (миксеры, мерные стаканы и т.п.), не сырьё. Тот же остаток-на-лету
    паттерн, что у Material/Transaction, но отдельная пара таблиц: EquipmentItem
    списывается по поломке/пропаже с фиксацией траты, Material — по рецептам.
    Раздел виден только Founder/Developer (см. app/routers/equipment.py)."""

    __tablename__ = "equipment_items"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(255))
    unit: Mapped[str] = mapped_column(String(20), default="шт")
    min_stock: Mapped[float] = mapped_column(Numeric(12, 3), default=0)

    transactions: Mapped[list["EquipmentTransaction"]] = relationship(back_populates="item")


class EquipmentTransaction(Base):
    __tablename__ = "equipment_transactions"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    date: Mapped[date_] = mapped_column(Date, default=date_.today)
    item_id: Mapped[str] = mapped_column(ForeignKey("equipment_items.id"))
    type: Mapped[str] = mapped_column(String(20))
    qty: Mapped[float] = mapped_column(Numeric(12, 3))
    # cost — трата по этому движению (закупка при приходе, ремонт при поломке,
    # замена при пропаже). Опционально — не всегда известна/применима.
    cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    item: Mapped["EquipmentItem"] = relationship(back_populates="transactions")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(100))
    gtin: Mapped[str] = mapped_column(String(50))
    composition: Mapped[str | None] = mapped_column(Text)
    recipe_id: Mapped[str | None] = mapped_column(ForeignKey("recipes.id"))
    tn_ved: Mapped[str | None] = mapped_column(String(50))
    declaration: Mapped[str | None] = mapped_column(String(255))
    declaration_expires: Mapped[date_ | None] = mapped_column(Date)

    recipe: Mapped["Recipe | None"] = relationship()


class Counterparty(Base):
    __tablename__ = "counterparties"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(255))
    inn: Mapped[str | None] = mapped_column(String(20))
    kpp: Mapped[str | None] = mapped_column(String(20))
    ogrn: Mapped[str | None] = mapped_column(String(20))
    legal_address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(50))
    contact_person: Mapped[str | None] = mapped_column(String(255))
    comment: Mapped[str | None] = mapped_column(Text)


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    date: Mapped[date_] = mapped_column(Date, default=date_.today)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    counterparty_id: Mapped[str | None] = mapped_column(ForeignKey("counterparties.id"))
    qty: Mapped[float] = mapped_column(Numeric(12, 3))
    price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Упаковочные поля отгрузки (2026-07-20, запрос Александра) — коробки/наклейки
    # считаются в штуках (размеры за смену бывают разные, единого физического "короба"
    # нет — считаем количество, не привязываясь к размеру), скотч в сантиметрах.
    # Курьер и логист — оба сразу могут быть на одной отгрузке, отдельные траты.
    box_count: Mapped[float | None] = mapped_column(Numeric(12, 3))
    tape_cm: Mapped[float | None] = mapped_column(Numeric(12, 3))
    sticker_count: Mapped[float | None] = mapped_column(Numeric(12, 3))
    courier_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    logist_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))

    product: Mapped["Product"] = relationship()
    counterparty: Mapped["Counterparty | None"] = relationship()


class ProductionLog(Base):
    __tablename__ = "production_log"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    date: Mapped[date_] = mapped_column(Date, default=date_.today)
    worker_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    recipe_id: Mapped[str] = mapped_column(ForeignKey("recipes.id"))
    # batches — для списания сырья (qty_per_batch × batches), может не делиться ровно на
    # выход партии рецепта и терять точность в Numeric(12,3) при обратном пересчёте. qty —
    # то, что реально ввёл человек ("Количество продукта", 2026-07-18) — хранится отдельно
    # и НЕ реконструируется из batches×yield, чтобы не терять точность на некратных
    # соотношениях (code-review 2026-07-18 поймал: qty=10 при yield=3 показывало бы 9.999).
    qty: Mapped[float] = mapped_column(Numeric(12, 3))
    batches: Mapped[float] = mapped_column(Numeric(12, 3))
    started_at: Mapped[datetime] = mapped_column(DateTime)
    finished_at: Mapped[datetime] = mapped_column(DateTime)
    defects: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    comment: Mapped[str | None] = mapped_column(Text)

    worker: Mapped["User"] = relationship()
    recipe: Mapped["Recipe"] = relationship()


class PackagingLog(Base):
    __tablename__ = "packaging_log"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    date: Mapped[date_] = mapped_column(Date, default=date_.today)
    worker_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    qty: Mapped[float] = mapped_column(Numeric(12, 3))
    defects: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    worker: Mapped["User"] = relationship()
    product: Mapped["Product"] = relationship()


class DashboardWidgetLayout(Base):
    """Раскладка виджетов дашборда — общая на всю компанию (founder и developer одной
    мастерской видят одно и то же), не per-user, но своя у каждой компании. Одна строка
    на активный виджет; удаление виджета с дашборда — просто DELETE строки, добавление —
    INSERT с позицией по умолчанию."""

    __tablename__ = "dashboard_widget_layout"
    __table_args__ = (UniqueConstraint("company_id", "widget_key", name="uq_company_widget"),)

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    widget_key: Mapped[str] = mapped_column(String(50))
    x: Mapped[int] = mapped_column(Integer)
    y: Mapped[int] = mapped_column(Integer)
    w: Mapped[int] = mapped_column(Integer)
    h: Mapped[int] = mapped_column(Integer)


class TechLog(Base):
    """Персистентный буфер логов техпанели (2026-07-19, замена in-memory deque в
    app/techlog.py) — глобальная, НЕ company-scoped: это серверные логи для
    разработчика, не бизнес-данные компании (тот же класс исключения, что и
    POST /api/companies, см. "Архитектурные принципы" п.5 в CLAUDE.md). Ретеншн 30
    дней, самоочистка — см. app/techlog.py, без cron."""

    __tablename__ = "tech_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    level: Mapped[str] = mapped_column(String(20))
    logger: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(8), primary_key=True, default=_short_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    date: Mapped[date_] = mapped_column(Date, default=date_.today)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    author_role: Mapped[str] = mapped_column(String(20))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="новое")
