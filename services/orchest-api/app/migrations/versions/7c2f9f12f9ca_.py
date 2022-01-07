"""Add total_scheduled_pipeline_runs to jobs.

Revision ID: 7c2f9f12f9ca
Revises: ef7f54441e8f
Create Date: 2021-12-21 14:42:13.835797

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "7c2f9f12f9ca"
down_revision = "ef7f54441e8f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "jobs",
        sa.Column(
            "total_scheduled_pipeline_runs",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("jobs", "total_scheduled_pipeline_runs")
