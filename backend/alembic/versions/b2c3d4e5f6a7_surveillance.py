"""surveillance camera settings + screenshots

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-23 12:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'camera_settings',
        sa.Column('company_id', sa.String(8), sa.ForeignKey('companies.id'), primary_key=True),
        sa.Column('stream_url', sa.String(500), nullable=True),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )
    op.create_table(
        'surveillance_screenshots',
        sa.Column('id', sa.String(8), primary_key=True),
        sa.Column('company_id', sa.String(8), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('user_id', sa.String(8), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('taken_at', sa.DateTime, nullable=False),
        sa.Column('image_base64', sa.Text, nullable=False),
        sa.Column('comment', sa.String(255), nullable=True),
    )
    op.create_index('ix_surveillance_screenshots_company_id', 'surveillance_screenshots', ['company_id'])


def downgrade() -> None:
    op.drop_index('ix_surveillance_screenshots_company_id', table_name='surveillance_screenshots')
    op.drop_table('surveillance_screenshots')
    op.drop_table('camera_settings')
