"""Add is_admin and token_hash columns to users

Revision ID: 9918c83b98a0
Revises: 5080f751f7d0
Create Date: 2021-03-04 15:33:31.651392

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "9918c83b98a0"
down_revision = "5080f751f7d0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "is_admin", sa.Boolean(), server_default=sa.text("False"), nullable=False
        ),
    )
    op.add_column(
        "users", sa.Column("token_hash", sa.String(length=255), nullable=True)
    )


def downgrade():
    op.drop_column("users", "token_hash")
    op.drop_column("users", "is_admin")
