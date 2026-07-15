import sys
from pathlib import Path

# core/*.py лежит в корне репозитория (на уровень выше backend/), а не внутри backend/ —
# добавляем корень в sys.path, чтобы `import core.config` работал при запуске
# `uvicorn app.main:app` из backend/.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import auth, dashboard, ingredients, production, products, recipes, sales

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


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
