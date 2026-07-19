"""material purchase attrs

Revision ID: f1a2b3c4d5e6
Revises: e5f1a2b3c4d6
Create Date: 2026-07-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'e5f1a2b3c4d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Закупочные атрибуты карточки компонента — все опциональны (nullable), не у
    каждого материала есть все эти данные, и существующие строки не бэкфиллятся."""
    op.add_column("materials", sa.Column("unit_cost", sa.Numeric(12, 4), nullable=True))
    op.add_column("materials", sa.Column("min_purchase_batch_qty", sa.Numeric(12, 3), nullable=True))
    op.add_column("materials", sa.Column("min_purchase_batch_cost", sa.Numeric(12, 2), nullable=True))
    op.add_column("materials", sa.Column("min_purchase_batch_weight", sa.Numeric(12, 3), nullable=True))
    op.add_column("materials", sa.Column("supplier", sa.String(length=255), nullable=True))
    op.add_column("materials", sa.Column("inci", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("materials", "inci")
    op.drop_column("materials", "supplier")
    op.drop_column("materials", "min_purchase_batch_weight")
    op.drop_column("materials", "min_purchase_batch_cost")
    op.drop_column("materials", "min_purchase_batch_qty")
    op.drop_column("materials", "unit_cost")
