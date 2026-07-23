"""material packaging fields

Revision ID: a1b2c3d4e5f6
Revises: f7a8b9c0d1e2
Create Date: 2026-07-23 10:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('materials', sa.Column('packaging_type', sa.String(20), nullable=True))
    op.add_column('materials', sa.Column('width_mm', sa.Numeric(10, 2), nullable=True))
    op.add_column('materials', sa.Column('height_mm', sa.Numeric(10, 2), nullable=True))
    op.add_column('materials', sa.Column('length_mm', sa.Numeric(10, 2), nullable=True))
    op.add_column('materials', sa.Column('volume_ml', sa.Numeric(10, 2), nullable=True))
    op.add_column('materials', sa.Column('material_finish', sa.String(50), nullable=True))
    op.add_column('materials', sa.Column('tape_feature', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('materials', 'tape_feature')
    op.drop_column('materials', 'material_finish')
    op.drop_column('materials', 'volume_ml')
    op.drop_column('materials', 'length_mm')
    op.drop_column('materials', 'height_mm')
    op.drop_column('materials', 'width_mm')
    op.drop_column('materials', 'packaging_type')
