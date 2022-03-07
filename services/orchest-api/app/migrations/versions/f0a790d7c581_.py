"""InteractiveSessionInUseImage

Revision ID: f0a790d7c581
Revises: 82759678fab3
Create Date: 2022-03-07 09:49:23.128946

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f0a790d7c581"
down_revision = "82759678fab3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "interactive_session_in_use_images",
        sa.Column("project_uuid", sa.String(length=36), nullable=False),
        sa.Column("pipeline_uuid", sa.String(length=36), nullable=False),
        sa.Column("environment_uuid", sa.String(length=36), nullable=False),
        sa.Column("environment_image_tag", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_uuid", "environment_uuid", "environment_image_tag"],
            [
                "environment_images.project_uuid",
                "environment_images.environment_uuid",
                "environment_images.tag",
            ],
            name=op.f(
                "fk_interactive_session_in_use_images_project_uuid_environment_uuid_"
                "environment_image_tag_environment_images"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_uuid", "pipeline_uuid"],
            ["interactive_sessions.project_uuid", "interactive_sessions.pipeline_uuid"],
            name=op.f(
                "fk_interactive_session_in_use_images_project_uuid_pipeline_uuid_"
                "interactive_sessions"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "project_uuid",
            "pipeline_uuid",
            "environment_uuid",
            "environment_image_tag",
            name=op.f("pk_interactive_session_in_use_images"),
        ),
    )
    op.create_index(
        op.f("ix_interactive_session_in_use_images_environment_image_tag"),
        "interactive_session_in_use_images",
        ["environment_image_tag"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interactive_session_in_use_images_environment_uuid"),
        "interactive_session_in_use_images",
        ["environment_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interactive_session_in_use_images_pipeline_uuid"),
        "interactive_session_in_use_images",
        ["pipeline_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interactive_session_in_use_images_project_uuid"),
        "interactive_session_in_use_images",
        ["project_uuid"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_interactive_session_in_use_images_project_uuid"),
        table_name="interactive_session_in_use_images",
    )
    op.drop_index(
        op.f("ix_interactive_session_in_use_images_pipeline_uuid"),
        table_name="interactive_session_in_use_images",
    )
    op.drop_index(
        op.f("ix_interactive_session_in_use_images_environment_uuid"),
        table_name="interactive_session_in_use_images",
    )
    op.drop_index(
        op.f("ix_interactive_session_in_use_images_environment_image_tag"),
        table_name="interactive_session_in_use_images",
    )
    op.drop_table("interactive_session_in_use_images")
