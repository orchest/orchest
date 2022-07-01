"""Make User.username unique

Revision ID: 9376105c8654
Revises: 9918c83b98a0
Create Date: 2022-06-29 09:42:24.384835

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "9376105c8654"
down_revision = "9918c83b98a0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint(op.f("uq_users_username"), "users", ["username"])


def downgrade():
    op.drop_constraint(op.f("uq_users_username"), "users", type_="unique")
