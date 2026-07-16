"""multi-tenant company_id

Revision ID: a772deab8f2a
Revises: a6ef319d4cb7
Create Date: 2026-07-16 17:39:52.497159

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a772deab8f2a'
down_revision: Union[str, Sequence[str], None] = 'a6ef319d4cb7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Все существующие данные бэкфиллятся в эту "компанию по умолчанию" — текущую
# мастерскую Founder. Фиксированный id (не uuid4, как обычно генерит _short_id) —
# чтобы миграция была детерминированной и её можно было прогнать повторно/сверить.
_DEFAULT_COMPANY_ID = "a0000001"

# Таблицы, получающие company_id по одинаковому паттерну: добавить nullable,
# забэкфиллить, сделать NOT NULL, повесить FK.
_TABLES = [
    "users", "materials", "recipes", "transactions", "products",
    "counterparties", "sales", "production_log", "packaging_log",
    "dashboard_widget_layout", "feedback", "login_log",
]


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.String(length=8), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        sa.text("INSERT INTO companies (id, name, created_at) VALUES (:id, :name, now())")
        .bindparams(id=_DEFAULT_COMPANY_ID, name="oinarri")
    )

    for table in _TABLES:
        op.add_column(table, sa.Column("company_id", sa.String(length=8), nullable=True))
        op.execute(sa.text(f"UPDATE {table} SET company_id = :cid").bindparams(cid=_DEFAULT_COMPANY_ID))
        op.alter_column(table, "company_id", nullable=False)
        op.create_foreign_key(f"fk_{table}_company_id", table, "companies", ["company_id"], ["id"])

    # dashboard_widget_layout.widget_key был глобально уникален — теперь уникальность
    # только в пределах одной компании (у каждой компании своя раскладка виджетов).
    op.drop_constraint("dashboard_widget_layout_widget_key_key", "dashboard_widget_layout", type_="unique")
    op.create_unique_constraint(
        "uq_company_widget", "dashboard_widget_layout", ["company_id", "widget_key"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_company_widget", "dashboard_widget_layout", type_="unique")
    op.create_unique_constraint(
        "dashboard_widget_layout_widget_key_key", "dashboard_widget_layout", ["widget_key"]
    )

    for table in _TABLES:
        op.drop_constraint(f"fk_{table}_company_id", table, type_="foreignkey")
        op.drop_column(table, "company_id")

    op.drop_table("companies")
