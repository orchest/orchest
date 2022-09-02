"""Add SchedulerJob.status column

Revision ID: 66b801f7abfc
Revises: 7497b5211902
Create Date: 2022-08-30 12:18:54.070315

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "66b801f7abfc"
down_revision = "7497b5211902"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "scheduler_jobs",
        sa.Column(
            "status", sa.String(length=15), server_default="SUCCEEDED", nullable=False
        ),
    )


def downgrade():
    op.drop_column("scheduler_jobs", "status")
