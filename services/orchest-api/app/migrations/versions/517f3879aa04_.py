"""empty message

Revision ID: 517f3879aa04
Revises: d53e0d88a3a3
Create Date: 2022-03-08 12:22:45.247297

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "517f3879aa04"
down_revision = "d53e0d88a3a3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        op.f(
            "ix_environment_image_builds_project_uuid_environment_image_builds_"
            "environment_uuid_environment_image_builds_image_tag"
        ),
        "environment_image_builds",
        ["project_uuid", "environment_uuid", sa.text("image_tag DESC")],
        unique=False,
    )
    op.drop_index("project_uuid", table_name="environment_images")
    op.create_index(
        op.f(
            "ix_environment_images_project_uuid_environment_images_environment_uuid_"
            "environment_images_tag"
        ),
        "environment_images",
        ["project_uuid", "environment_uuid", sa.text("tag DESC")],
        unique=False,
    )
    op.create_index(
        op.f("ix_environment_images_project_uuid_environment_images_environment_uuid"),
        "environment_images",
        ["project_uuid", "environment_uuid"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_environment_images_project_uuid_environment_images_environment_uuid"),
        table_name="environment_images",
    )
    op.drop_index(
        op.f(
            "ix_environment_images_project_uuid_environment_images_environment_uuid_"
            "environment_images_tag"
        ),
        table_name="environment_images",
    )
    op.create_index(
        "project_uuid", "environment_images", ["environment_uuid"], unique=False
    )
    op.drop_index(
        op.f(
            "ix_environment_image_builds_project_uuid_environment_image_builds_"
            "environment_uuid_environment_image_builds_image_tag"
        ),
        table_name="environment_image_builds",
    )
