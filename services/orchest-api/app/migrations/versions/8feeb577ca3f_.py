"""Add job_image_mappings

Revision ID: 8feeb577ca3f
Revises: 282ad223e2d0
Create Date: 2021-06-25 09:38:37.742084

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "8feeb577ca3f"
down_revision = "282ad223e2d0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "job_image_mappings",
        sa.Column("job_uuid", sa.String(length=36), nullable=False),
        sa.Column("orchest_environment_uuid", sa.String(length=36), nullable=False),
        sa.Column("docker_img_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["job_uuid"],
            ["jobs.uuid"],
            name=op.f("fk_job_image_mappings_job_uuid_jobs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "job_uuid",
            "orchest_environment_uuid",
            "docker_img_id",
            name=op.f("pk_job_image_mappings"),
        ),
        sa.UniqueConstraint(
            "job_uuid",
            "docker_img_id",
            name=op.f("uq_job_image_mappings_job_uuid_docker_img_id"),
        ),
        sa.UniqueConstraint(
            "job_uuid",
            "orchest_environment_uuid",
            name=op.f("uq_job_image_mappings_job_uuid_orchest_environment_uuid"),
        ),
    )
    op.create_index(
        op.f("ix_job_image_mappings_docker_img_id"),
        "job_image_mappings",
        ["docker_img_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_job_image_mappings_job_uuid"),
        "job_image_mappings",
        ["job_uuid"],
        unique=False,
    )
    op.create_index(
        op.f("ix_job_image_mappings_orchest_environment_uuid"),
        "job_image_mappings",
        ["orchest_environment_uuid"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_job_image_mappings_orchest_environment_uuid"),
        table_name="job_image_mappings",
    )
    op.drop_index(
        op.f("ix_job_image_mappings_job_uuid"), table_name="job_image_mappings"
    )
    op.drop_index(
        op.f("ix_job_image_mappings_docker_img_id"), table_name="job_image_mappings"
    )
    op.drop_table("job_image_mappings")
