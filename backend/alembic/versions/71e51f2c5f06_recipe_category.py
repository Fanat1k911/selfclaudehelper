"""recipe category

Revision ID: 71e51f2c5f06
Revises: 51f8858f3a3a
Create Date: 2026-07-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '71e51f2c5f06'
down_revision: Union[str, Sequence[str], None] = '51f8858f3a3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('recipes', sa.Column('category', sa.String(length=100), nullable=False, server_default=''))
    op.alter_column('recipes', 'category', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('recipes', 'category')
