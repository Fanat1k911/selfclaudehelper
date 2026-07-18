"""production_log qty

Revision ID: c1d4e9f2a8b3
Revises: 2963dcbe68c7
Create Date: 2026-07-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d4e9f2a8b3'
down_revision: Union[str, Sequence[str], None] = '2963dcbe68c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Добавляет qty (кол-во ГОТОВОГО ПРОДУКТА, введённое человеком) отдельно от batches
    (партии, для списания сырья) — 2026-07-18, форма "Внести производство" перешла с
    ввода партий на ввод продукта (см. CLAUDE.md). Существующие записи бэкфиллятся как
    batches × выход партии рецепта на момент миграции — тот же расчёт, что раньше
    показывался напрямую как "кол-во партий", просто теперь в явном отдельном столбце,
    без риска потери точности при повторной реконструкции из batches (code-review 2026-07-18:
    batches — Numeric(12,3), обратное batches×yield на некратных соотношениях округляло бы
    не в ту сторону)."""
    op.add_column("production_log", sa.Column("qty", sa.Numeric(precision=12, scale=3), nullable=True))
    op.execute(
        sa.text(
            "UPDATE production_log SET qty = production_log.batches * recipes.batch_yield "
            "FROM recipes WHERE recipes.id = production_log.recipe_id"
        )
    )
    op.alter_column("production_log", "qty", nullable=False)


def downgrade() -> None:
    op.drop_column("production_log", "qty")
