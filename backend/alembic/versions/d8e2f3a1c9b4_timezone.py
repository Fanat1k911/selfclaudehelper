"""timezone

Revision ID: d8e2f3a1c9b4
Revises: c1d4e9f2a8b3
Create Date: 2026-07-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8e2f3a1c9b4'
down_revision: Union[str, Sequence[str], None] = 'c1d4e9f2a8b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DEFAULT_TZ = "Europe/Moscow"


def upgrade() -> None:
    """company.timezone — по умолчанию для всех существующих компаний Europe/Moscow
    (реальная мастерская Founder физически там, тестовые компании поправимы вручную
    позже). user.timezone — личное необязательное переопределение, NULL по умолчанию
    (значит "как в компании"), не бэкфиллится."""
    op.add_column("companies", sa.Column("timezone", sa.String(length=64), nullable=True))
    op.execute(sa.text("UPDATE companies SET timezone = :tz").bindparams(tz=_DEFAULT_TZ))
    op.alter_column("companies", "timezone", nullable=False, server_default=_DEFAULT_TZ)

    op.add_column("users", sa.Column("timezone", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "timezone")
    op.drop_column("companies", "timezone")
