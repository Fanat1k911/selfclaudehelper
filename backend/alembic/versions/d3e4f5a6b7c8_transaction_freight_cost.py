"""transaction freight cost

Revision ID: d3e4f5a6b7c8
Revises: c7d8e9f0a1b2
Create Date: 2026-07-21 08:20:00.000000

Себестоимость лотов (app/costing.py) — доля транспортных расходов поставки, отнесённая
на конкретную строку прихода (см. app/routers/ingredients.py::add_income_batch).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, Sequence[str], None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("freight_cost", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "freight_cost")
