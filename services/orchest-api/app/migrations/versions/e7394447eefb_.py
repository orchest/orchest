"""Add stored_in_registry to images models.

Revision ID: e7394447eefb
Revises: 3433a9040ff4
Create Date: 2022-08-12 09:36:23.204783

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e7394447eefb"
down_revision = "3433a9040ff4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "environment_images",
        sa.Column(
            "stored_in_registry", sa.Boolean(), server_default="True", nullable=False
        ),
    )
    op.add_column(
        "jupyter_images",
        sa.Column(
            "stored_in_registry", sa.Boolean(), server_default="True", nullable=False
        ),
    )


def downgrade():
    op.drop_column("jupyter_images", "stored_in_registry")
    op.drop_column("environment_images", "stored_in_registry")
