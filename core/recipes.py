"""Рецепты: что производим и из чего (состав на 1 партию)."""

import uuid

import pandas as pd

from core.config import RECIPE_ITEMS_HEADERS, RECIPES_HEADERS, SHEET_RECIPE_ITEMS, SHEET_RECIPES
from core.sheets import append_row, read_sheet


def read_recipes() -> pd.DataFrame:
    return read_sheet(SHEET_RECIPES, headers=RECIPES_HEADERS)


def read_recipe_items() -> pd.DataFrame:
    return read_sheet(SHEET_RECIPE_ITEMS, headers=RECIPE_ITEMS_HEADERS)


def add_recipe(name: str, produces: str, batch_yield: float, technology: str = "") -> str:
    """Возвращает id созданного рецепта — пригодится сразу добавлять RecipeItems."""
    recipe_id = uuid.uuid4().hex[:8]
    row = [recipe_id, name, produces, batch_yield, technology]
    append_row(SHEET_RECIPES, row, headers=RECIPES_HEADERS)
    return recipe_id


def add_recipe_item(recipe_id: str, material_id: str, qty_per_batch: float) -> None:
    row = [recipe_id, material_id, qty_per_batch]
    append_row(SHEET_RECIPE_ITEMS, row, headers=RECIPE_ITEMS_HEADERS)
