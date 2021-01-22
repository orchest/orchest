"""empty message

Revision ID: d73e8267e975
Revises: 96f304f85ee5
Create Date: 2021-01-22 14:48:27.824164

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "d73e8267e975"
down_revision = "96f304f85ee5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "jobs",
        sa.Column(
            "next_scheduled_time", postgresql.TIMESTAMP(timezone=True), nullable=True
        ),
    )
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
    op.drop_column("jobs", "scheduled_start")
    op.drop_column("jobs", "total_number_of_pipeline_runs")
    op.add_column(
        "pipeline_runs",
        sa.Column(
            "job_run_index", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
    )
    op.add_column(
        "pipeline_runs",
        sa.Column("job_run_pipeline_run_index", sa.Integer(), nullable=True),
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
    op.add_column(
        "pipeline_runs", sa.Column("pipeline_run_index", sa.Integer(), nullable=True)
    )
    op.create_index(
        op.f("ix_pipeline_runs_job_uuid"), "pipeline_runs", ["job_uuid"], unique=False
    )
    op.create_unique_constraint(
        op.f("uq_pipeline_runs_job_uuid_job_run_index_job_run_pipeline_run_index"),
        "pipeline_runs",
        ["job_uuid", "job_run_index", "job_run_pipeline_run_index"],
    )
    op.create_unique_constraint(
        op.f("uq_pipeline_runs_job_uuid_pipeline_run_index"),
        "pipeline_runs",
        ["job_uuid", "pipeline_run_index"],
    )
    op.drop_column("pipeline_runs", "pipeline_run_id")


def downgrade():
    op.add_column(
        "pipeline_runs",
        sa.Column("pipeline_run_id", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.drop_constraint(
        op.f("uq_pipeline_runs_job_uuid_pipeline_run_index"),
        "pipeline_runs",
        type_="unique",
    )
    op.drop_constraint(
        op.f("uq_pipeline_runs_job_uuid_job_run_index_job_run_pipeline_run_index"),
        "pipeline_runs",
        type_="unique",
    )
    op.drop_index(op.f("ix_pipeline_runs_job_uuid"), table_name="pipeline_runs")
    op.drop_column("pipeline_runs", "pipeline_run_index")
    op.drop_column("pipeline_runs", "parameters")
    op.drop_column("pipeline_runs", "job_run_pipeline_run_index")
    op.drop_column("pipeline_runs", "job_run_index")
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
            "scheduled_start",
            postgresql.TIMESTAMP(),
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
    op.drop_column("jobs", "parameters")
    op.drop_column("jobs", "next_scheduled_time")
