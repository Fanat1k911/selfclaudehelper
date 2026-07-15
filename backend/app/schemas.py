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


class SaleRequest(BaseModel):
    product_id: str
    qty: float
    price: float | None = None
    comment: str = ""
