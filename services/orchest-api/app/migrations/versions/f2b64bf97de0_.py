"""Make jobs.snapshot_uuid NOT NULL

Revision ID: f2b64bf97de0
Revises: 7beba3ba9e66
Create Date: 2022-08-29 09:38:12.817567

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f2b64bf97de0"
down_revision = "7beba3ba9e66"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "jobs", "snapshot_uuid", existing_type=sa.VARCHAR(length=36), nullable=False
    )


def downgrade():
    op.alter_column(
        "jobs", "snapshot_uuid", existing_type=sa.VARCHAR(length=36), nullable=True
    )
