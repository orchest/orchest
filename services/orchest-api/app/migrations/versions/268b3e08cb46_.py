"""empty message

Revision ID: 268b3e08cb46
Revises: 2b573339900f
Create Date: 2022-05-17 10:46:41.928452

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "268b3e08cb46"
down_revision = "2b573339900f"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint(
        "fk_events_project_uuid_pipeline_uuid_interactive_sessions",
        "events",
        type_="foreignkey",
    )


def downgrade():
    op.create_foreign_key(
        "fk_events_project_uuid_pipeline_uuid_interactive_sessions",
        "events",
        "interactive_sessions",
        ["project_uuid", "pipeline_uuid"],
        ["project_uuid", "pipeline_uuid"],
        ondelete="CASCADE",
    )
