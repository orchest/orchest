"""Add index to Job.snapshot_uuid

Revision ID: c5b150e99eda
Revises: f2b64bf97de0
Create Date: 2022-08-29 13:45:54.232844

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c5b150e99eda"
down_revision = "f2b64bf97de0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        op.f("ix_jobs_snapshot_uuid"), "jobs", ["snapshot_uuid"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_jobs_snapshot_uuid"), table_name="jobs")
