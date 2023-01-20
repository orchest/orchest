"""empty message

Revision ID: c7eb1647cba3
Revises: 4aee53e26a92
Create Date: 2023-01-04 15:30:52.170029

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c7eb1647cba3"
down_revision = "4aee53e26a92"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index(
        "ix_pipeline_runs_project_uuid_pipeline_uuid", table_name="pipeline_runs"
    )
    op.create_index(
        op.f(
            "ix_pipeline_runs_created_time_pipeline_runs_project_uuid_pipeline_runs_status_pipeline_runs_pipeline_uuid"
        ),
        "pipeline_runs",
        ["created_time", "project_uuid", "status", "pipeline_uuid"],
        unique=False,
    )
    op.create_index(
        op.f(
            "ix_pipeline_runs_project_uuid_pipeline_runs_pipeline_uuid_pipeline_runs_created_time"
        ),
        "pipeline_runs",
        ["project_uuid", "pipeline_uuid", "created_time"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f(
            "ix_pipeline_runs_project_uuid_pipeline_runs_pipeline_uuid_pipeline_runs_created_time"
        ),
        table_name="pipeline_runs",
    )
    op.drop_index(
        op.f(
            "ix_pipeline_runs_created_time_pipeline_runs_project_uuid_pipeline_runs_status_pipeline_runs_pipeline_uuid"
        ),
        table_name="pipeline_runs",
    )
    op.create_index(
        "ix_pipeline_runs_project_uuid_pipeline_uuid",
        "pipeline_runs",
        ["project_uuid", "pipeline_uuid"],
        unique=False,
    )
