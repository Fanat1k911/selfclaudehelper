"""counterparties

Revision ID: bd7cde2869b3
Revises: 71e51f2c5f06
Create Date: 2026-07-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bd7cde2869b3'
down_revision: Union[str, Sequence[str], None] = '71e51f2c5f06'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'counterparties',
        sa.Column('id', sa.String(length=8), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('inn', sa.String(length=20), nullable=True),
        sa.Column('kpp', sa.String(length=20), nullable=True),
        sa.Column('ogrn', sa.String(length=20), nullable=True),
        sa.Column('legal_address', sa.Text(), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('contact_person', sa.String(length=255), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('sales', sa.Column('counterparty_id', sa.String(length=8), nullable=True))
    op.create_foreign_key(
        'fk_sales_counterparty_id', 'sales', 'counterparties', ['counterparty_id'], ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_sales_counterparty_id', 'sales', type_='foreignkey')
    op.drop_column('sales', 'counterparty_id')
    op.drop_table('counterparties')
