"""Extend Job and PipelineRun for scheduling.

Revision ID: df18d500ee7a
Revises: 96f304f85ee5
Create Date: 2021-01-21 13:07:25.127456

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "df18d500ee7a"
down_revision = "96f304f85ee5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "jobs",
        sa.Column(
            "parameters",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
        ),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "next_scheduled_time", postgresql.TIMESTAMP(timezone=True), nullable=True
        ),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "pipeline_definition",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "pipeline_run_spec",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )
    op.add_column("jobs", sa.Column("schedule", sa.String(length=100), nullable=True))
    op.add_column(
        "jobs",
        sa.Column(
            "status",
            sa.String(length=15),
            server_default=sa.text("'SUCCESS'"),
            nullable=False,
        ),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "total_scheduled_executions",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=True,
        ),
    )
    op.create_index(
        op.f("ix_jobs_next_scheduled_time"),
        "jobs",
        ["next_scheduled_time"],
        unique=False,
    )
    op.drop_column("jobs", "completed_pipeline_runs")
    op.drop_column("jobs", "total_number_of_pipeline_runs")
    op.drop_column("jobs", "scheduled_start")
    op.add_column(
        "pipeline_runs",
        sa.Column(
            "job_schedule_number",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "pipeline_runs",
        sa.Column(
            "parameters",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )
    op.create_index(
        op.f("ix_pipeline_runs_job_uuid"), "pipeline_runs", ["job_uuid"], unique=False
    )
    op.create_unique_constraint(
        op.f("uq_pipeline_runs_job_uuid_job_schedule_number_pipeline_run_id"),
        "pipeline_runs",
        ["job_uuid", "job_schedule_number", "pipeline_run_id"],
    )


def downgrade():
    op.drop_constraint(
        op.f("uq_pipeline_runs_job_uuid_job_schedule_number_pipeline_run_id"),
        "pipeline_runs",
        type_="unique",
    )
    op.drop_index(op.f("ix_pipeline_runs_job_uuid"), table_name="pipeline_runs")
    op.drop_column("pipeline_runs", "parameters")
    op.drop_column("pipeline_runs", "job_schedule_number")
    op.add_column(
        "jobs",
        sa.Column(
            "scheduled_start",
            postgresql.TIMESTAMP(),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "total_number_of_pipeline_runs",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "completed_pipeline_runs",
            sa.INTEGER(),
            server_default=sa.text("0"),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.drop_index(op.f("ix_jobs_next_scheduled_time"), table_name="jobs")
    op.drop_column("jobs", "total_scheduled_executions")
    op.drop_column("jobs", "status")
    op.drop_column("jobs", "schedule")
    op.drop_column("jobs", "pipeline_run_spec")
    op.drop_column("jobs", "pipeline_definition")
    op.drop_column("jobs", "next_scheduled_time")
    op.drop_column("jobs", "parameters")
