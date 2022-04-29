"""Add EnvironmentImage.marked_for_removal

Revision ID: 4694f9241649
Revises: da0cc2d95c2b
Create Date: 2022-04-13 08:17:32.447378

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "4694f9241649"
down_revision = "da0cc2d95c2b"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "environment_images",
        sa.Column(
            "marked_for_removal", sa.Boolean(), server_default="False", nullable=False
        ),
    )
    op.create_index(
        op.f("ix_environment_images_marked_for_removal"),
        "environment_images",
        ["marked_for_removal"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_environment_images_marked_for_removal"),
        table_name="environment_images",
    )
    op.drop_column("environment_images", "marked_for_removal")
