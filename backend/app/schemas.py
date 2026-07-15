from pydantic import BaseModel


class LoginRequest(BaseModel):
    login: str
    password: str


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


class NewRecipeRequest(BaseModel):
    name: str
    produces: str
    batch_yield: float
    technology: str = ""


class NewRecipeItemRequest(BaseModel):
    material_id: str
    qty_per_batch: float


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
    qty: float
    price: float | None = None
    comment: str = ""


class NewUserRequest(BaseModel):
    fio: str
    login: str
    password: str
    role: str
    phone: str = ""
    messenger: str = ""
    address: str = ""
    document: str = ""


class UpdateUserRequest(BaseModel):
    fio: str | None = None
    role: str | None = None
    status: str | None = None
    phone: str | None = None
    messenger: str | None = None
    address: str | None = None
    document: str | None = None


class ResetPasswordRequest(BaseModel):
    new_password: str


class ImportCommitRow(BaseModel):
    material_id: str
    new_qty: float


class ImportCommitRequest(BaseModel):
    rows: list[ImportCommitRow]
    comment: str = "импорт из файла"
