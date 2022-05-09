"""Add JobPipelineRunEvent model and related event types

Revision ID: 814961a3d525
Revises: fd5293064883
Create Date: 2022-04-25 08:00:44.620148

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "814961a3d525"
down_revision = "fd5293064883"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "events", sa.Column("pipeline_run_uuid", sa.String(length=36), nullable=True)
    )
    op.create_foreign_key(
        op.f("fk_events_pipeline_run_uuid_pipeline_runs"),
        "events",
        "pipeline_runs",
        ["pipeline_run_uuid"],
        ["uuid"],
        ondelete="CASCADE",
    )

    op.execute(
        """
        INSERT INTO event_types (name) values
        ('project:one-off-job:pipeline-run:created'),
        ('project:one-off-job:pipeline-run:started'),
        ('project:one-off-job:pipeline-run:cancelled'),
        ('project:one-off-job:pipeline-run:failed'),
        ('project:one-off-job:pipeline-run:deleted'),
        ('project:one-off-job:pipeline-run:succeeded')
        ;
        """
    )


def downgrade():
    op.drop_constraint(
        op.f("fk_events_pipeline_run_uuid_pipeline_runs"), "events", type_="foreignkey"
    )
    op.drop_column("events", "pipeline_run_uuid")
