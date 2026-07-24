"""widget layout mobile width

Revision ID: a9b8c7d6e5f4
Revises: d4e5f6a7b8c9
Create Date: 2026-07-24 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9b8c7d6e5f4'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('dashboard_widget_layout', sa.Column('mobile_w', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('dashboard_widget_layout', 'mobile_w')
