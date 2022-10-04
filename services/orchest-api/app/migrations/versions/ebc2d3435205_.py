"""Add cluster_nodes table.

Revision ID: ebc2d3435205
Revises: e7394447eefb
Create Date: 2022-08-12 09:42:47.709094

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "ebc2d3435205"
down_revision = "e7394447eefb"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cluster_nodes",
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("name", name=op.f("pk_cluster_nodes")),
    )


def downgrade():
    op.drop_table("cluster_nodes")
