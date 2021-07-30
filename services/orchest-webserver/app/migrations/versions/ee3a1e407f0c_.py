"""Add pipelines.status

Revision ID: ee3a1e407f0c
Revises: 7a1ce16fbd70
Create Date: 2021-06-11 13:20:32.038382

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "ee3a1e407f0c"
down_revision = "7a1ce16fbd70"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "pipelines",
        sa.Column(
            "status",
            sa.String(length=15),
            server_default=sa.text("'READY'"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("pipelines", "status")
