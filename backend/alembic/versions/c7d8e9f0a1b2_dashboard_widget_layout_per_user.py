"""dashboard widget layout per user

Revision ID: c7d8e9f0a1b2
Revises: b4c5d6e7f8a9
Create Date: 2026-07-20 19:45:00.000000

Раскладка виджетов дашборда была общей на компанию (founder/developer видели одно и то
же) — по просьбе Александра (2026-07-20) переводим на per-user: каждый настраивает себе
сам. Существующие строки не несут user_id и не могут быть надёжно приписаны конкретному
человеку (общая раскладка компании, не чья-то персональная) — сбрасываем их, каждый
пользователь получит дефолтную раскладку каталога виджетов и настроит заново.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, Sequence[str], None] = 'b4c5d6e7f8a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("DELETE FROM dashboard_widget_layout"))
    op.drop_constraint("uq_company_widget", "dashboard_widget_layout", type_="unique")
    op.add_column("dashboard_widget_layout", sa.Column("user_id", sa.String(length=8), nullable=False))
    op.create_foreign_key(
        "fk_dashboard_widget_layout_user_id", "dashboard_widget_layout", "users", ["user_id"], ["id"]
    )
    op.create_unique_constraint(
        "uq_company_user_widget", "dashboard_widget_layout", ["company_id", "user_id", "widget_key"]
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM dashboard_widget_layout"))
    op.drop_constraint("uq_company_user_widget", "dashboard_widget_layout", type_="unique")
    op.drop_constraint("fk_dashboard_widget_layout_user_id", "dashboard_widget_layout", type_="foreignkey")
    op.drop_column("dashboard_widget_layout", "user_id")
    op.create_unique_constraint(
        "uq_company_widget", "dashboard_widget_layout", ["company_id", "widget_key"]
    )
