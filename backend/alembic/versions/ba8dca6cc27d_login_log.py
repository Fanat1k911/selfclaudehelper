"""login_log

Revision ID: ba8dca6cc27d
Revises: 7991290b2e2b
Create Date: 2026-07-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ba8dca6cc27d'
down_revision: Union[str, Sequence[str], None] = '7991290b2e2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'login_log',
        sa.Column('id', sa.String(length=8), nullable=False),
        sa.Column('user_id', sa.String(length=8), nullable=False),
        sa.Column('logged_in_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('login_log')
