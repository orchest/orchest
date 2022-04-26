"""Add ProjectEvent and JobEvent models

Revision ID: fd5293064883
Revises: 3d9dc4c0a82a
Create Date: 2022-04-22 12:48:10.353363

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "fd5293064883"
down_revision = "3d9dc4c0a82a"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "events", sa.Column("project_uuid", sa.String(length=36), nullable=True)
    )
    op.add_column("events", sa.Column("job_uuid", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        op.f("fk_events_project_uuid_projects"),
        "events",
        "projects",
        ["project_uuid"],
        ["uuid"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        op.f("fk_events_job_uuid_jobs"),
        "events",
        "jobs",
        ["job_uuid"],
        ["uuid"],
        ondelete="CASCADE",
    )


def downgrade():
    op.drop_constraint(op.f("fk_events_job_uuid_jobs"), "events", type_="foreignkey")
    op.drop_constraint(
        op.f("fk_events_project_uuid_projects"), "events", type_="foreignkey"
    )
    op.drop_column("events", "job_uuid")
    op.drop_column("events", "project_uuid")
