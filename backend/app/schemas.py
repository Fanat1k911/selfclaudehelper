import re

from pydantic import BaseModel, Field, field_validator

PHONE_RE = re.compile(r"^[0-9+\-()\s]*$")
DIGITS_RE = re.compile(r"^[0-9]*$")


def _check_phone(value: str | None) -> str | None:
    if value and not PHONE_RE.match(value):
        raise ValueError("Телефон может содержать только цифры и + - ( )")
    return value


def _check_digits(value: str | None, label: str) -> str | None:
    if value and not DIGITS_RE.match(value):
        raise ValueError(f"{label} может содержать только цифры")
    return value


class LoginRequest(BaseModel):
    login: str
    password: str


class SelectCompanyRequest(BaseModel):
    """Второй шаг логина мульти-компанийного пользователя (см. app/security.py)."""

    pending_token: str
    company_id: str


class SwitchCompanyRequest(BaseModel):
    """Переключение активной компании уже залогиненного пользователя (сайдбар)."""

    company_id: str


class DashboardLayoutItem(BaseModel):
    widget_key: str
    x: int
    y: int
    w: int
    h: int


class NewMaterialRequest(BaseModel):
    name: str
    category: str
    unit: str
    initial_qty: float = 0.0
    min_stock: float = 0.0


class MaterialAttrsUpdate(BaseModel):
    """Закупочные поля карточки компонента (2026-07-19) — частичное обновление
    через model_dump(exclude_unset=True) в роутере: пропущенное в запросе поле не
    трогается, явно присланный null — очищает."""

    unit_cost: float | None = None
    min_purchase_batch_qty: float | None = None
    min_purchase_batch_cost: float | None = None
    min_purchase_batch_weight: float | None = None
    supplier: str | None = None
    inci: str | None = None


class TransactionRequest(BaseModel):
    qty: float
    price: float | None = None
    comment: str = ""


class AdjustmentRequest(BaseModel):
    actual_qty: float
    comment: str = ""


class BatchIncomeItem(BaseModel):
    material_id: str
    qty: float
    price: float | None = None


class BatchIncomeRequest(BaseModel):
    items: list[BatchIncomeItem]
    transport_cost: float = 0
    comment: str = ""


class NewEquipmentRequest(BaseModel):
    name: str
    unit: str = "шт"
    initial_qty: float = 0.0
    min_stock: float = 0.0


class EquipmentTransactionRequest(BaseModel):
    qty: float
    cost: float | None = None
    comment: str = ""


class EquipmentAdjustmentRequest(BaseModel):
    actual_qty: float
    comment: str = ""


class ProductionRequest(BaseModel):
    """qty — кол-во ГОТОВОГО ПРОДУКТА, не партий (2026-07-18, решение Founder: "Количество
    партий" → "Количество продукта" — рабочим проще считать штуками/кг продукта, чем
    партиями рецепта). Партии для списания сырья считаются от qty делением на выход
    партии рецепта (см. app/routers/production.py::create_production) — материально это
    та же величина, просто другая единица ввода. started_at/finished_at убраны из РУЧНОГО
    ввода (тем же решением) — на бэке проставляются автоматически (started_at = первый вход
    сотрудника сегодня из LoginLog, finished_at = момент внесения записи), не приходят с
    фронта. Метрика скорости в KPI из них по-прежнему не считается (dashboard/leaderboard
    используют только qty−defects, см. ProductionLog.qty) — это задел на будущее, не
    активная фича."""

    recipe_id: str
    qty: float
    defects: float = 0.0
    comment: str = ""


class NewRecipeItemRequest(BaseModel):
    material_id: str
    qty_per_batch: float


class NewRecipeRequest(BaseModel):
    name: str
    category: str
    produces: str
    batch_yield: float
    technology: str = ""
    items: list[NewRecipeItemRequest] = []


class UpdateRecipeArchivedRequest(BaseModel):
    archived: bool


class PackagingRequest(BaseModel):
    product_id: str
    qty: float
    defects: float = 0.0
    comment: str = ""


class NewProductRequest(BaseModel):
    name: str
    category: str
    gtin: str
    composition: str = ""
    recipe_id: str = ""
    tn_ved: str = ""
    declaration: str = ""
    declaration_expires: str = ""


class ProductImportRow(BaseModel):
    name: str
    category: str
    gtin: str
    tn_ved: str = ""
    declaration: str = ""
    declaration_expires: str = ""
    recipe_id: str = ""


class ProductImportCommitRequest(BaseModel):
    rows: list[ProductImportRow]


class UpdateProductRequest(BaseModel):
    name: str | None = None
    category: str | None = None
    gtin: str | None = None
    composition: str | None = None
    recipe_id: str | None = None
    tn_ved: str | None = None
    declaration: str | None = None
    declaration_expires: str | None = None


class SaleRequest(BaseModel):
    product_id: str
    counterparty_id: str = ""
    qty: float
    price: float | None = None
    comment: str = ""
    box_count: float | None = None
    tape_cm: float | None = None
    sticker_count: float | None = None
    courier_cost: float | None = None
    logist_cost: float | None = None


class SaleUpdateRequest(BaseModel):
    """Редактирование уже созданной отгрузки (2026-07-20) — Founder/Developer,
    любое поле, частично через model_dump(exclude_unset=True) в роутере."""

    product_id: str | None = None
    counterparty_id: str | None = None
    qty: float | None = None
    price: float | None = None
    comment: str | None = None
    box_count: float | None = None
    tape_cm: float | None = None
    sticker_count: float | None = None
    courier_cost: float | None = None
    logist_cost: float | None = None


class NewCounterpartyRequest(BaseModel):
    name: str
    inn: str = ""
    kpp: str = ""
    ogrn: str = ""
    legal_address: str = ""
    phone: str = ""
    contact_person: str = ""
    comment: str = ""

    _check_phone = field_validator("phone")(_check_phone)

    @field_validator("inn")
    @classmethod
    def _v_inn(cls, v: str) -> str:
        return _check_digits(v, "ИНН")

    @field_validator("kpp")
    @classmethod
    def _v_kpp(cls, v: str) -> str:
        return _check_digits(v, "КПП")

    @field_validator("ogrn")
    @classmethod
    def _v_ogrn(cls, v: str) -> str:
        return _check_digits(v, "ОГРН")


class UpdateCounterpartyRequest(BaseModel):
    name: str | None = None
    inn: str | None = None
    kpp: str | None = None
    ogrn: str | None = None
    legal_address: str | None = None
    phone: str | None = None
    contact_person: str | None = None
    comment: str | None = None

    _check_phone = field_validator("phone")(_check_phone)

    @field_validator("inn")
    @classmethod
    def _v_inn(cls, v: str | None) -> str | None:
        return _check_digits(v, "ИНН")

    @field_validator("kpp")
    @classmethod
    def _v_kpp(cls, v: str | None) -> str | None:
        return _check_digits(v, "КПП")

    @field_validator("ogrn")
    @classmethod
    def _v_ogrn(cls, v: str | None) -> str | None:
        return _check_digits(v, "ОГРН")


class NewUserRequest(BaseModel):
    fio: str
    login: str
    password: str
    role: str
    phone: str = ""
    messenger: str = ""
    address: str = ""
    document: str = ""

    _check_phone = field_validator("phone")(_check_phone)


class NewCompanyRequest(BaseModel):
    """Заведение нового тенанта разработчиком (см. app/routers/companies.py) —
    вместе с компанией сразу создаётся первый Developer-аккаунт этой компании,
    Founder заводит сам разработчик отдельно после."""

    company_name: str
    fio: str
    login: str
    password: str
    timezone: str = "Europe/Moscow"


class RegisterCompanyRequest(BaseModel):
    """Публичная саморегистрация (2026-07-18, без залогиненного Developer, см. CLAUDE.md →
    "Публичная self-serve регистрация") — компания + первый Founder этой компании, сразу
    логинит. Телефон обязателен уже сейчас — с прицелом на будущую SMS/Telegram-верификацию,
    сам механизм которой пока не выбран (см. CLAUDE.md), это не блокирует первый заход.

    max_length здесь (в отличие от NewCompanyRequest/NewUserRequest выше, тех же полей без
    ограничений) — этот эндпоинт публичный и анонимный, а не только для залогиненного
    Founder/Developer: без границ длины company_name/fio/login падал бы неперехваченным
    500 (DataError) на INSERT в Postgres при значении длиннее колонки — SQLite в тестах
    эту ошибку не ловит, что маскировало баг (security-review 2026-07-18)."""

    company_name: str = Field(max_length=255)
    fio: str = Field(max_length=255)
    login: str = Field(max_length=100)
    password: str
    phone: str
    timezone: str = "Europe/Moscow"

    @field_validator("phone")
    @classmethod
    def _v_phone(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Телефон обязателен.")
        return _check_phone(v)

    @field_validator("password")
    @classmethod
    def _v_password(cls, v: str) -> str:
        # По байтам, не символам — bcrypt (>=4.2) кидает ValueError на пароле длиннее 72
        # БАЙТ, а не 72 символов; кириллица — 2 байта на символ в UTF-8, так что чисто
        # символьный max_length здесь пропустил бы слишком длинные не-ASCII пароли и всё
        # равно уронил бы hashpw в 500 (найдено на security-review 2026-07-18, там же
        # воспроизведён сам ValueError на реальном bcrypt).
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Пароль слишком длинный.")
        return v


class UpdateUserRequest(BaseModel):
    fio: str | None = None
    role: str | None = None
    status: str | None = None
    phone: str | None = None
    messenger: str | None = None
    address: str | None = None
    document: str | None = None
    # Личное переопределение часового пояса компании (2026-07-18) — тот же паттерн, что и
    # у phone/address выше: пустая строка очищает override (снова действует пояс компании).
    timezone: str | None = None

    _check_phone = field_validator("phone")(_check_phone)


class ResetPasswordRequest(BaseModel):
    new_password: str


class ImportCommitRow(BaseModel):
    material_id: str
    new_qty: float


class ImportCommitRequest(BaseModel):
    rows: list[ImportCommitRow]
    comment: str = "импорт из файла"
