"""SchedulerJob schema changes

Revision ID: 1cc5332f9b55
Revises: 66b801f7abfc
Create Date: 2022-09-02 08:30:37.375153

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "1cc5332f9b55"
down_revision = "66b801f7abfc"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE scheduler_jobs DROP CONSTRAINT pk_scheduler_jobs CASCADE")
    op.add_column(
        "scheduler_jobs",
        sa.Column(
            "uuid",
            sa.String(length=36),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
    )
    op.add_column(
        "scheduler_jobs",
        sa.Column(
            "started_time",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.add_column(
        "scheduler_jobs",
        sa.Column(
            "finished_time",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.drop_column("scheduler_jobs", "timestamp")
    op.create_primary_key("pk_scheduler_jobs", "scheduler_jobs", ["uuid"])


def downgrade():
    op.add_column(
        "scheduler_jobs",
        sa.Column(
            "timestamp",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.drop_column("scheduler_jobs", "finished_time")
    op.drop_column("scheduler_jobs", "started_time")
    op.drop_column("scheduler_jobs", "uuid")
