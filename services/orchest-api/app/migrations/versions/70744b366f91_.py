"""Improve environment image indexes

Revision ID: 70744b366f91
Revises: 927a3f79fdc2
Create Date: 2022-03-07 11:05:47.502514

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "70744b366f91"
down_revision = "927a3f79fdc2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        op.f("ix_environment_images_project_uuid"),
        "environment_images",
        ["project_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_environment_images_tag"), "environment_images", ["tag"], unique=False
    )
    op.create_index(
        "project_uuid", "environment_images", ["environment_uuid"], unique=False
    )


def downgrade():
    op.drop_index("project_uuid", table_name="environment_images")
    op.drop_index(op.f("ix_environment_images_tag"), table_name="environment_images")
    op.drop_index(
        op.f("ix_environment_images_project_uuid"), table_name="environment_images"
    )
