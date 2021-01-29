"""Add CASCADE to tokens FK

Revision ID: 39ce3b205482
Revises: acb725fe8e8e
Create Date: 2021-01-29 12:02:45.575450

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "39ce3b205482"
down_revision = "acb725fe8e8e"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("fk_tokens_user_users", "tokens", type_="foreignkey")
    op.create_foreign_key(
        op.f("fk_tokens_user_users"),
        "tokens",
        "users",
        ["user"],
        ["uuid"],
        ondelete="CASCADE",
    )


def downgrade():
    op.drop_constraint(op.f("fk_tokens_user_users"), "tokens", type_="foreignkey")
    op.create_foreign_key("fk_tokens_user_users", "tokens", "users", ["user"], ["uuid"])
