from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import auth, counterparties, dashboard, ingredients, packaging, production, products, recipes, sales, users

app = FastAPI(title="oinarri API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(ingredients.router)
app.include_router(dashboard.router)
app.include_router(production.router)
app.include_router(recipes.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(users.router)
app.include_router(counterparties.router)
app.include_router(packaging.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
