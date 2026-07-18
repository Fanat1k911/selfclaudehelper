"""company memberships — multi-company users

Revision ID: 2963dcbe68c7
Revises: a772deab8f2a
Create Date: 2026-07-18 08:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2963dcbe68c7'
down_revision: Union[str, Sequence[str], None] = 'a772deab8f2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "company_memberships",
        sa.Column("id", sa.String(length=8), nullable=False),
        sa.Column("user_id", sa.String(length=8), nullable=False),
        sa.Column("company_id", sa.String(length=8), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.UniqueConstraint("user_id", "company_id", name="uq_user_company"),
    )

    # Бэкфилл: у каждого существующего юзера ровно одна компания/роль — переносим как есть.
    op.execute(
        sa.text(
            "INSERT INTO company_memberships (id, user_id, company_id, role, created_at) "
            "SELECT substr(md5(random()::text || id), 1, 8), id, company_id, role, created_at FROM users"
        )
    )

    op.drop_constraint("fk_users_company_id", "users", type_="foreignkey")
    op.drop_column("users", "company_id")
    op.drop_column("users", "role")


def downgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("company_id", sa.String(length=8), nullable=True))

    # Даунгрейд теряет multi-company юзеров (берём первое членство) — приемлемо для
    # отката, это не рассчитано на сценарий "уже кто-то реально в 2+ компаниях".
    op.execute(
        sa.text(
            "UPDATE users SET company_id = m.company_id, role = m.role "
            "FROM (SELECT DISTINCT ON (user_id) user_id, company_id, role FROM company_memberships "
            "ORDER BY user_id, created_at) m WHERE users.id = m.user_id"
        )
    )

    op.alter_column("users", "company_id", nullable=False)
    op.alter_column("users", "role", nullable=False)
    op.create_foreign_key("fk_users_company_id", "users", "companies", ["company_id"], ["id"])

    op.drop_table("company_memberships")
