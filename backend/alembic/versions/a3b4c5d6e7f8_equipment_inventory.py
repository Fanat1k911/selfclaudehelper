"""equipment inventory

Revision ID: a3b4c5d6e7f8
Revises: f1a2b3c4d5e6
Create Date: 2026-07-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Рабочий инвентарь — отдельная пара таблиц, зеркалит materials/transactions
    (см. app/models.py::EquipmentItem/EquipmentTransaction)."""
    op.create_table(
        "equipment_items",
        sa.Column("id", sa.String(length=8), primary_key=True),
        sa.Column("company_id", sa.String(length=8), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="шт"),
        sa.Column("min_stock", sa.Numeric(12, 3), nullable=False, server_default="0"),
    )
    op.create_table(
        "equipment_transactions",
        sa.Column("id", sa.String(length=8), primary_key=True),
        sa.Column("company_id", sa.String(length=8), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("item_id", sa.String(length=8), sa.ForeignKey("equipment_items.id"), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("qty", sa.Numeric(12, 3), nullable=False),
        sa.Column("cost", sa.Numeric(12, 2), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("equipment_transactions")
    op.drop_table("equipment_items")
