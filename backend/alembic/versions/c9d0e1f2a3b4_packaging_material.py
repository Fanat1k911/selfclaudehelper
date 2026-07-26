"""packaging log material + product default packaging material

Revision ID: c9d0e1f2a3b4
Revises: a9b8c7d6e5f4
Create Date: 2026-07-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, Sequence[str], None] = 'a9b8c7d6e5f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('packaging_log', sa.Column('material_id', sa.String(length=8), nullable=True))
    op.create_foreign_key(
        'fk_packaging_log_material_id', 'packaging_log', 'materials', ['material_id'], ['id']
    )
    op.add_column('products', sa.Column('default_packaging_material_id', sa.String(length=8), nullable=True))
    op.create_foreign_key(
        'fk_products_default_packaging_material_id', 'products', 'materials',
        ['default_packaging_material_id'], ['id']
    )
    op.add_column(
        'production_log',
        sa.Column('packaged', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('production_log', 'packaged')
    op.drop_constraint('fk_products_default_packaging_material_id', 'products', type_='foreignkey')
    op.drop_column('products', 'default_packaging_material_id')
    op.drop_constraint('fk_packaging_log_material_id', 'packaging_log', type_='foreignkey')
    op.drop_column('packaging_log', 'material_id')
