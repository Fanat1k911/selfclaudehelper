"""workshop network heartbeat (replaces DDNS hostname)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-24 06:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('companies', 'worker_network_hostname')
    op.add_column('companies', sa.Column('worker_network_enabled', sa.Boolean, nullable=False, server_default='false'))
    op.add_column('companies', sa.Column('worker_network_token', sa.String(64), nullable=True))
    op.create_index('ix_companies_worker_network_token', 'companies', ['worker_network_token'], unique=True)
    op.add_column('companies', sa.Column('worker_network_ip', sa.String(64), nullable=True))
    op.add_column('companies', sa.Column('worker_network_ip_updated_at', sa.DateTime, nullable=True))


def downgrade() -> None:
    op.drop_column('companies', 'worker_network_ip_updated_at')
    op.drop_column('companies', 'worker_network_ip')
    op.drop_index('ix_companies_worker_network_token', table_name='companies')
    op.drop_column('companies', 'worker_network_token')
    op.drop_column('companies', 'worker_network_enabled')
    op.add_column('companies', sa.Column('worker_network_hostname', sa.String(255), nullable=True))
