"""sale fulfillment fields

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4c5d6e7f8a9'
down_revision: Union[str, Sequence[str], None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Упаковочные/логистические поля отгрузки — все опциональны, существующие
    строки не бэкфиллятся (данных о коробках/скотче для старых отгрузок нет)."""
    op.add_column("sales", sa.Column("box_count", sa.Numeric(12, 3), nullable=True))
    op.add_column("sales", sa.Column("tape_cm", sa.Numeric(12, 3), nullable=True))
    op.add_column("sales", sa.Column("sticker_count", sa.Numeric(12, 3), nullable=True))
    op.add_column("sales", sa.Column("courier_cost", sa.Numeric(12, 2), nullable=True))
    op.add_column("sales", sa.Column("logist_cost", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("sales", "logist_cost")
    op.drop_column("sales", "courier_cost")
    op.drop_column("sales", "sticker_count")
    op.drop_column("sales", "tape_cm")
    op.drop_column("sales", "box_count")
