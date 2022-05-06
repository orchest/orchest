"""Add SchedulerJob model

Revision ID: 6bbe0b4a8c4a
Revises: 21f4696fb7af
Create Date: 2022-04-21 12:00:42.222084

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "6bbe0b4a8c4a"
down_revision = "21f4696fb7af"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "scheduler_jobs",
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column(
            "timestamp",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("type", name=op.f("pk_scheduler_jobs")),
    )


def downgrade():
    op.drop_table("scheduler_jobs")
