"""tech_log and event timestamps

Revision ID: e5f1a2b3c4d6
Revises: d8e2f3a1c9b4
Create Date: 2026-07-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f1a2b3c4d6'
down_revision: Union[str, Sequence[str], None] = 'd8e2f3a1c9b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """tech_log — персистентная замена in-memory буфера техпанели, глобальная
    (не company-scoped, см. модель TechLog). created_at на Transaction/Sale/
    PackagingLog — точность до секунды для сортировки виджета "5 последних
    событий" (существующий date — только день, руками вводится); server_default
    now() бэкфиллит существующие строки, дальше пишет SQLAlchemy default."""
    op.create_table(
        "tech_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("time", sa.DateTime(), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column("logger", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
    )
    op.create_index("ix_tech_log_time", "tech_log", ["time"])

    for table in ("transactions", "sales", "packaging_log"):
        op.add_column(
            table, sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now())
        )
        op.alter_column(table, "created_at", server_default=None)


def downgrade() -> None:
    for table in ("transactions", "sales", "packaging_log"):
        op.drop_column(table, "created_at")
    op.drop_index("ix_tech_log_time", table_name="tech_log")
    op.drop_table("tech_log")
