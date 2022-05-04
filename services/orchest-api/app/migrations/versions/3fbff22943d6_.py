"""empty message

Revision ID: 3fbff22943d6
Revises: bab71acdcd61
Create Date: 2022-04-25 10:34:01.569021

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "3fbff22943d6"
down_revision = "bab71acdcd61"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        op.f("ix_events_type_events_project_uuid_events_job_uuid_events_run_index"),
        "events",
        ["type", "project_uuid", "job_uuid", "run_index"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_events_type_events_project_uuid_events_job_uuid_events_run_index"),
        table_name="events",
    )
