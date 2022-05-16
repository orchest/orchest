"""empty message

Revision ID: d53e0d88a3a3
Revises: c43d1ef75230
Create Date: 2022-03-08 12:04:44.545962

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "d53e0d88a3a3"
down_revision = "c43d1ef75230"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint(
        "fk_environment_image_builds_project_uuid_environment_uu_57af",
        "environment_image_builds",
        type_="foreignkey",
    )
    op.drop_index("project_uuid", table_name="environment_images")
    op.create_index(
        "project_uuid", "environment_images", ["environment_uuid"], unique=False
    )
    op.create_foreign_key(
        op.f(
            "fk_environment_images_project_uuid_environment_uuid_tag_environment_"
            "image_builds"
        ),
        "environment_images",
        "environment_image_builds",
        ["project_uuid", "environment_uuid", "tag"],
        ["project_uuid", "environment_uuid", "image_tag"],
        ondelete="CASCADE",
    )


def downgrade():
    op.drop_constraint(
        op.f(
            "fk_environment_images_project_uuid_environment_uuid_tag_environment_"
            "image_builds"
        ),
        "environment_images",
        type_="foreignkey",
    )
    op.drop_index("project_uuid", table_name="environment_images")
    op.create_index(
        "project_uuid", "environment_images", ["environment_uuid", "tag"], unique=False
    )
    op.create_foreign_key(
        "fk_environment_image_builds_project_uuid_environment_uu_57af",
        "environment_image_builds",
        "environment_images",
        ["project_uuid", "environment_uuid", "image_tag"],
        ["project_uuid", "environment_uuid", "tag"],
        ondelete="CASCADE",
    )
