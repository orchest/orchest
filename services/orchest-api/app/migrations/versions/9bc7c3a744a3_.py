"""Add last_scheduled_time column to jobs.

Revision ID: 9bc7c3a744a3
Revises: 1dc3553c4e7e
Create Date: 2021-01-27 12:49:33.474620

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "9bc7c3a744a3"
down_revision = "1dc3553c4e7e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "jobs",
        sa.Column(
            "last_scheduled_time", postgresql.TIMESTAMP(timezone=True), nullable=True
        ),
    )
    op.create_index(
        op.f("ix_jobs_last_scheduled_time"),
        "jobs",
        ["last_scheduled_time"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_jobs_last_scheduled_time"), table_name="jobs")
    op.drop_column("jobs", "last_scheduled_time")
