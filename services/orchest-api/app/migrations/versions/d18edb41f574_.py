"""PipelineRunInUseImage

Revision ID: d18edb41f574
Revises: f1694a7aaea1
Create Date: 2022-03-07 10:03:26.302935

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d18edb41f574"
down_revision = "f1694a7aaea1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pipeline_run_in_use_images",
        sa.Column("run_uuid", sa.String(length=36), nullable=False),
        sa.Column("project_uuid", sa.String(length=36), nullable=False),
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
                "fk_pipeline_run_in_use_images_project_uuid_environment_uuid_"
                "environment_image_tag_environment_images"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_uuid"],
            ["pipeline_runs.uuid"],
            name=op.f("fk_pipeline_run_in_use_images_run_uuid_pipeline_runs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "run_uuid",
            "project_uuid",
            "environment_uuid",
            "environment_image_tag",
            name=op.f("pk_pipeline_run_in_use_images"),
        ),
    )
    op.create_index(
        op.f("ix_pipeline_run_in_use_images_environment_image_tag"),
        "pipeline_run_in_use_images",
        ["environment_image_tag"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pipeline_run_in_use_images_environment_uuid"),
        "pipeline_run_in_use_images",
        ["environment_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pipeline_run_in_use_images_project_uuid"),
        "pipeline_run_in_use_images",
        ["project_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_pipeline_run_in_use_images_run_uuid"),
        "pipeline_run_in_use_images",
        ["run_uuid"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_pipeline_run_in_use_images_run_uuid"),
        table_name="pipeline_run_in_use_images",
    )
    op.drop_index(
        op.f("ix_pipeline_run_in_use_images_project_uuid"),
        table_name="pipeline_run_in_use_images",
    )
    op.drop_index(
        op.f("ix_pipeline_run_in_use_images_environment_uuid"),
        table_name="pipeline_run_in_use_images",
    )
    op.drop_index(
        op.f("ix_pipeline_run_in_use_images_environment_image_tag"),
        table_name="pipeline_run_in_use_images",
    )
    op.drop_table("pipeline_run_in_use_images")
