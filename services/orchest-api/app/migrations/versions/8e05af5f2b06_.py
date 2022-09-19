"""Add job.snapshot_uuid column

Revision ID: 8e05af5f2b06
Revises: ba252b957597
Create Date: 2022-08-29 08:27:32.416220

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "8e05af5f2b06"
down_revision = "ba252b957597"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "jobs", sa.Column("snapshot_uuid", sa.String(length=36), nullable=True)
    )
    op.create_foreign_key(
        op.f("fk_jobs_snapshot_uuid_snapshots"),
        "jobs",
        "snapshots",
        ["snapshot_uuid"],
        ["uuid"],
        ondelete="CASCADE",
    )


def downgrade():
    op.drop_constraint(
        op.f("fk_jobs_snapshot_uuid_snapshots"), "jobs", type_="foreignkey"
    )
    op.drop_column("jobs", "snapshot_uuid")
