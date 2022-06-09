"""Add PipelineEvent, InteractivePipelineRunEvent model and event types

Revision ID: 637920f5715f
Revises: 849b7b154ef6
Create Date: 2022-05-16 09:25:56.549523

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "637920f5715f"
down_revision = "849b7b154ef6"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        INSERT INTO event_types (name) values
        ('project:pipeline:interactive-session:pipeline-run:created'),
        ('project:pipeline:interactive-session:pipeline-run:started'),
        ('project:pipeline:interactive-session:pipeline-run:cancelled'),
        ('project:pipeline:interactive-session:pipeline-run:failed'),
        ('project:pipeline:interactive-session:pipeline-run:succeeded')
        ;
        """
    )
    op.create_foreign_key(
        op.f("fk_events_project_uuid_pipeline_uuid_pipelines"),
        "events",
        "pipelines",
        ["project_uuid", "pipeline_uuid"],
        ["project_uuid", "uuid"],
        ondelete="CASCADE",
    )


def downgrade():
    op.drop_constraint(
        op.f("fk_events_project_uuid_pipeline_uuid_pipelines"),
        "events",
        type_="foreignkey",
    )
