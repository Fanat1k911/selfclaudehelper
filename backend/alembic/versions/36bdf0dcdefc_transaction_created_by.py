"""transaction created_by

Revision ID: 36bdf0dcdefc
Revises: d1e2f3a4b5c6
Create Date: 2026-09-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '36bdf0dcdefc'
down_revision: Union[str, Sequence[str], None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Кто внёс движение компонента (приход/расход/корректировка) — для "Последних
    действий" на карточке сотрудника. Nullable: существующие записи не бэкфиллятся,
    автора для них раньше просто не сохраняли."""
    op.add_column("transactions", sa.Column("created_by", sa.String(length=8), nullable=True))
    op.create_foreign_key(
        "fk_transactions_created_by_users", "transactions", "users", ["created_by"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint("fk_transactions_created_by_users", "transactions", type_="foreignkey")
    op.drop_column("transactions", "created_by")
