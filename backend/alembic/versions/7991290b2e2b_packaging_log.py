"""packaging_log

Revision ID: 7991290b2e2b
Revises: bd7cde2869b3
Create Date: 2026-07-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7991290b2e2b'
down_revision: Union[str, Sequence[str], None] = 'bd7cde2869b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'packaging_log',
        sa.Column('id', sa.String(length=8), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('worker_id', sa.String(length=8), nullable=False),
        sa.Column('product_id', sa.String(length=8), nullable=False),
        sa.Column('qty', sa.Numeric(12, 3), nullable=False),
        sa.Column('defects', sa.Numeric(12, 3), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['worker_id'], ['users.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('packaging_log')
