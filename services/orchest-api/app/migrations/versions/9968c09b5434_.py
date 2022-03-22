"""empty message

Revision ID: 9968c09b5434
Revises: ff2c8613b0df
Create Date: 2022-03-04 12:16:09.705852

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "9968c09b5434"
down_revision = "ff2c8613b0df"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index(
        "ix_interactive_session_image_mappings_docker_img_id",
        table_name="interactive_session_image_mappings",
    )
    op.drop_index(
        "ix_interactive_session_image_mappings_orchest_environment_uuid",
        table_name="interactive_session_image_mappings",
    )
    op.drop_index(
        "ix_interactive_session_image_mappings_pipeline_uuid",
        table_name="interactive_session_image_mappings",
    )
    op.drop_index(
        "ix_interactive_session_image_mappings_project_uuid",
        table_name="interactive_session_image_mappings",
    )
    op.drop_table("interactive_session_image_mappings")
    op.drop_index(
        "ix_pipeline_run_image_mappings_docker_img_id",
        table_name="pipeline_run_image_mappings",
    )
    op.drop_index(
        "ix_pipeline_run_image_mappings_orchest_environment_uuid",
        table_name="pipeline_run_image_mappings",
    )
    op.drop_index(
        "ix_pipeline_run_image_mappings_run_uuid",
        table_name="pipeline_run_image_mappings",
    )
    op.drop_table("pipeline_run_image_mappings")
    op.drop_index(
        "ix_job_image_mappings_docker_img_id", table_name="job_image_mappings"
    )
    op.drop_index("ix_job_image_mappings_job_uuid", table_name="job_image_mappings")
    op.drop_index(
        "ix_job_image_mappings_orchest_environment_uuid",
        table_name="job_image_mappings",
    )
    op.drop_table("job_image_mappings")


def downgrade():
    op.create_table(
        "job_image_mappings",
        sa.Column(
            "job_uuid", sa.VARCHAR(length=36), autoincrement=False, nullable=False
        ),
        sa.Column(
            "orchest_environment_uuid",
            sa.VARCHAR(length=36),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("docker_img_id", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["job_uuid"],
            ["jobs.uuid"],
            name="fk_job_image_mappings_job_uuid_jobs",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "job_uuid",
            "orchest_environment_uuid",
            "docker_img_id",
            name="pk_job_image_mappings",
        ),
        sa.UniqueConstraint(
            "job_uuid",
            "docker_img_id",
            name="uq_job_image_mappings_job_uuid_docker_img_id",
        ),
        sa.UniqueConstraint(
            "job_uuid",
            "orchest_environment_uuid",
            name="uq_job_image_mappings_job_uuid_orchest_environment_uuid",
        ),
    )
    op.create_index(
        "ix_job_image_mappings_orchest_environment_uuid",
        "job_image_mappings",
        ["orchest_environment_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_job_image_mappings_job_uuid",
        "job_image_mappings",
        ["job_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_job_image_mappings_docker_img_id",
        "job_image_mappings",
        ["docker_img_id"],
        unique=False,
    )
    op.create_table(
        "pipeline_run_image_mappings",
        sa.Column(
            "run_uuid", sa.VARCHAR(length=36), autoincrement=False, nullable=False
        ),
        sa.Column(
            "orchest_environment_uuid",
            sa.VARCHAR(length=36),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("docker_img_id", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["run_uuid"],
            ["pipeline_runs.uuid"],
            name="fk_pipeline_run_image_mappings_run_uuid_pipeline_runs",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "run_uuid",
            "orchest_environment_uuid",
            "docker_img_id",
            name="pk_pipeline_run_image_mappings",
        ),
        sa.UniqueConstraint(
            "run_uuid",
            "docker_img_id",
            name="uq_pipeline_run_image_mappings_run_uuid_docker_img_id",
        ),
        sa.UniqueConstraint(
            "run_uuid",
            "orchest_environment_uuid",
            name="uq_pipeline_run_image_mappings_run_uuid_orchest_environ_418d",
        ),
    )
    op.create_index(
        "ix_pipeline_run_image_mappings_run_uuid",
        "pipeline_run_image_mappings",
        ["run_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_pipeline_run_image_mappings_orchest_environment_uuid",
        "pipeline_run_image_mappings",
        ["orchest_environment_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_pipeline_run_image_mappings_docker_img_id",
        "pipeline_run_image_mappings",
        ["docker_img_id"],
        unique=False,
    )
    op.create_table(
        "interactive_session_image_mappings",
        sa.Column(
            "project_uuid", sa.VARCHAR(length=36), autoincrement=False, nullable=False
        ),
        sa.Column(
            "pipeline_uuid", sa.VARCHAR(length=36), autoincrement=False, nullable=False
        ),
        sa.Column(
            "orchest_environment_uuid",
            sa.VARCHAR(length=36),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("docker_img_id", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["project_uuid", "pipeline_uuid"],
            ["interactive_sessions.project_uuid", "interactive_sessions.pipeline_uuid"],
            name="fk_interactive_session_image_mappings_project_uuid_pipe_548d",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "project_uuid",
            "pipeline_uuid",
            "orchest_environment_uuid",
            "docker_img_id",
            name="pk_interactive_session_image_mappings",
        ),
        sa.UniqueConstraint(
            "project_uuid",
            "pipeline_uuid",
            "docker_img_id",
            name="uq_interactive_session_image_mappings_project_uuid_pipe_32eb",
        ),
        sa.UniqueConstraint(
            "project_uuid",
            "pipeline_uuid",
            "orchest_environment_uuid",
            name="uq_interactive_session_image_mappings_project_uuid_pipe_4f1b",
        ),
    )
    op.create_index(
        "ix_interactive_session_image_mappings_project_uuid",
        "interactive_session_image_mappings",
        ["project_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_interactive_session_image_mappings_pipeline_uuid",
        "interactive_session_image_mappings",
        ["pipeline_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_interactive_session_image_mappings_orchest_environment_uuid",
        "interactive_session_image_mappings",
        ["orchest_environment_uuid"],
        unique=False,
    )
    op.create_index(
        "ix_interactive_session_image_mappings_docker_img_id",
        "interactive_session_image_mappings",
        ["docker_img_id"],
        unique=False,
    )
