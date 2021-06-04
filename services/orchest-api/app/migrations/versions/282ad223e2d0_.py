"""Add InteractiveSessionImageMapping

Revision ID: 282ad223e2d0
Revises: efadd665f3f1
Create Date: 2021-06-04 08:55:16.510820

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "282ad223e2d0"
down_revision = "efadd665f3f1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "interactive_session_image_mappings",
        sa.Column("project_uuid", sa.String(length=36), nullable=False),
        sa.Column("pipeline_uuid", sa.String(length=36), nullable=False),
        sa.Column("orchest_environment_uuid", sa.String(length=36), nullable=False),
        sa.Column("docker_img_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_uuid", "pipeline_uuid"],
            ["interactive_sessions.project_uuid", "interactive_sessions.pipeline_uuid"],
            name=op.f(
                "fk_interactive_session_image_mappings_project_uuid_pipeline_uuid"
                "_interactive_sessions"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "project_uuid",
            "pipeline_uuid",
            "orchest_environment_uuid",
            "docker_img_id",
            name=op.f("pk_interactive_session_image_mappings"),
        ),
        sa.UniqueConstraint(
            "project_uuid",
            "pipeline_uuid",
            "docker_img_id",
            name=op.f(
                "uq_interactive_session_image_mappings_project_uuid_pipeline_uuid"
                "_docker_img_id"
            ),
        ),
        sa.UniqueConstraint(
            "project_uuid",
            "pipeline_uuid",
            "orchest_environment_uuid",
            name=op.f(
                "uq_interactive_session_image_mappings_project_uuid_pipeline_uuid"
                "_orchest_environment_uuid"
            ),
        ),
    )
    op.create_index(
        op.f("ix_interactive_session_image_mappings_docker_img_id"),
        "interactive_session_image_mappings",
        ["docker_img_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interactive_session_image_mappings_orchest_environment_uuid"),
        "interactive_session_image_mappings",
        ["orchest_environment_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interactive_session_image_mappings_pipeline_uuid"),
        "interactive_session_image_mappings",
        ["pipeline_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interactive_session_image_mappings_project_uuid"),
        "interactive_session_image_mappings",
        ["project_uuid"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_interactive_session_image_mappings_project_uuid"),
        table_name="interactive_session_image_mappings",
    )
    op.drop_index(
        op.f("ix_interactive_session_image_mappings_pipeline_uuid"),
        table_name="interactive_session_image_mappings",
    )
    op.drop_index(
        op.f("ix_interactive_session_image_mappings_orchest_environment_uuid"),
        table_name="interactive_session_image_mappings",
    )
    op.drop_index(
        op.f("ix_interactive_session_image_mappings_docker_img_id"),
        table_name="interactive_session_image_mappings",
    )
    op.drop_table("interactive_session_image_mappings")
