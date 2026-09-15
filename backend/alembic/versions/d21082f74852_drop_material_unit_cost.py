"""drop material unit_cost

Revision ID: d21082f74852
Revises: 36bdf0dcdefc
Create Date: 2026-09-13 00:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd21082f74852'
down_revision: Union[str, Sequence[str], None] = '36bdf0dcdefc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Ручное поле "себестоимость 1 шт" убрано (2026-09-13, запрос Александра) —
    себестоимость компонента теперь только из фактических поставок (app/costing.py::
    compute_active_lot_unit_costs), без прогноза/ручного ввода. Значения, которые
    были в этом поле, не переносятся никуда — это и была та самая "мифическая" цифра,
    от которой решили отказаться."""
    op.drop_column("materials", "unit_cost")


def downgrade() -> None:
    op.add_column("materials", sa.Column("unit_cost", sa.Numeric(12, 4), nullable=True))
