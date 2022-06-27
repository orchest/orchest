"""Add pipeline_runs.created_time

Revision ID: 3433a9040ff4
Revises: 1b1938d5587a
Create Date: 2022-06-27 08:46:15.127876

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "3433a9040ff4"
down_revision = "1b1938d5587a"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "pipeline_runs",
        sa.Column(
            "created_time",
            sa.DateTime(),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
    )
    op.create_index(
        op.f("ix_pipeline_runs_created_time"),
        "pipeline_runs",
        ["created_time"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_pipeline_runs_created_time"), table_name="pipeline_runs")
    op.drop_column("pipeline_runs", "created_time")
