from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import CORS_ORIGINS
from app.routers import auth, companies, counterparties, dashboard, ingredients, packaging, production, products, recipes, sales, techpanel, users
from app.techlog import install as install_techlog

app = FastAPI(title="oinarri API")
install_techlog()

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
app.include_router(techpanel.router)
app.include_router(companies.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


# Собранный фронт (Dockerfile копирует frontend/dist сюда) — раздаём тем же процессом,
# один домен, без CORS между фронтом и бэком в проде. В локальной разработке этой
# папки нет (фронт крутится отдельно через vite dev-сервер), маршрут просто не регистрируется.
_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "static"

if _FRONTEND_DIST.exists():

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str) -> FileResponse:
        requested = (_FRONTEND_DIST / full_path).resolve()
        if requested.is_relative_to(_FRONTEND_DIST) and requested.is_file():
            return FileResponse(requested)
        return FileResponse(_FRONTEND_DIST / "index.html")
