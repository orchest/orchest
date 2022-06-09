"""Add ProjectUpdateEvent, PipelineUpdateEvent models, event_types

Revision ID: 2b573339900f
Revises: 23def7128481
Create Date: 2022-05-17 08:59:51.787022

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2b573339900f"
down_revision = "23def7128481"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        INSERT INTO event_types (name) values
        ('project:created'),
        ('project:updated'),
        ('project:deleted'),
        ('project:pipeline:created'),
        ('project:pipeline:updated'),
        ('project:pipeline:deleted')
        ;
        """
    )
    op.add_column(
        "events",
        sa.Column("update", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade():
    op.drop_column("events", "update")
