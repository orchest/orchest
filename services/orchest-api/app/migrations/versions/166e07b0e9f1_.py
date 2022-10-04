"""Add SchedulerJob index

Revision ID: 166e07b0e9f1
Revises: 1cc5332f9b55
Create Date: 2022-09-02 10:26:20.964069

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "166e07b0e9f1"
down_revision = "1cc5332f9b55"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        op.f("ix_scheduler_jobs_type_scheduler_jobs_started_time"),
        "scheduler_jobs",
        ["type", sa.text("started_time DESC")],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_scheduler_jobs_type_scheduler_jobs_started_time"),
        table_name="scheduler_jobs",
    )
