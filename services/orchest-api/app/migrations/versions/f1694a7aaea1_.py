"""JobInUseImage

Revision ID: f1694a7aaea1
Revises: f0a790d7c581
Create Date: 2022-03-07 09:57:14.038820

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f1694a7aaea1"
down_revision = "f0a790d7c581"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "job_in_use_images",
        sa.Column("job_uuid", sa.String(length=36), nullable=False),
        sa.Column("project_uuid", sa.String(length=36), nullable=False),
        sa.Column("environment_uuid", sa.String(length=36), nullable=False),
        sa.Column("environment_image_tag", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["job_uuid"],
            ["jobs.uuid"],
            name=op.f("fk_job_in_use_images_job_uuid_jobs"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_uuid", "environment_uuid", "environment_image_tag"],
            [
                "environment_images.project_uuid",
                "environment_images.environment_uuid",
                "environment_images.tag",
            ],
            name=op.f(
                "fk_job_in_use_images_project_uuid_environment_uuid_environment_"
                "image_tag_environment_images"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "job_uuid",
            "project_uuid",
            "environment_uuid",
            "environment_image_tag",
            name=op.f("pk_job_in_use_images"),
        ),
    )
    op.create_index(
        op.f("ix_job_in_use_images_environment_image_tag"),
        "job_in_use_images",
        ["environment_image_tag"],
        unique=False,
    )
    op.create_index(
        op.f("ix_job_in_use_images_environment_uuid"),
        "job_in_use_images",
        ["environment_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_job_in_use_images_job_uuid"),
        "job_in_use_images",
        ["job_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_job_in_use_images_project_uuid"),
        "job_in_use_images",
        ["project_uuid"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_job_in_use_images_project_uuid"), table_name="job_in_use_images"
    )
    op.drop_index(op.f("ix_job_in_use_images_job_uuid"), table_name="job_in_use_images")
    op.drop_index(
        op.f("ix_job_in_use_images_environment_uuid"), table_name="job_in_use_images"
    )
    op.drop_index(
        op.f("ix_job_in_use_images_environment_image_tag"),
        table_name="job_in_use_images",
    )
    op.drop_table("job_in_use_images")
