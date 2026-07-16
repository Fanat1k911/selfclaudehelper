import re

from pydantic import BaseModel, field_validator

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


class DashboardLayoutItem(BaseModel):
    widget_key: str
    x: int
    y: int
    w: int
    h: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class NewMaterialRequest(BaseModel):
    name: str
    category: str
    unit: str
    initial_qty: float = 0.0
    min_stock: float = 0.0


class TransactionRequest(BaseModel):
    qty: float
    price: float | None = None
    comment: str = ""


class AdjustmentRequest(BaseModel):
    actual_qty: float
    comment: str = ""


class ProductionRequest(BaseModel):
    recipe_id: str
    batches: float
    started_at: str
    finished_at: str
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


class ProductImportCommitRequest(BaseModel):
    rows: list[ProductImportRow]


class SaleRequest(BaseModel):
    product_id: str
    counterparty_id: str = ""
    qty: float
    price: float | None = None
    comment: str = ""


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


class UpdateUserRequest(BaseModel):
    fio: str | None = None
    role: str | None = None
    status: str | None = None
    phone: str | None = None
    messenger: str | None = None
    address: str | None = None
    document: str | None = None

    _check_phone = field_validator("phone")(_check_phone)


class ResetPasswordRequest(BaseModel):
    new_password: str


class ImportCommitRow(BaseModel):
    material_id: str
    new_qty: float


class ImportCommitRequest(BaseModel):
    rows: list[ImportCommitRow]
    comment: str = "импорт из файла"
