"""Add cluster_node to image build tables.

Revision ID: 55a5e9795a44
Revises: ae9940ff7e51
Create Date: 2022-08-12 10:33:46.158138

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "55a5e9795a44"
down_revision = "ae9940ff7e51"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "environment_image_builds",
        sa.Column("cluster_node", sa.String(), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_environment_image_builds_cluster_node_cluster_nodes"),
        "environment_image_builds",
        "cluster_nodes",
        ["cluster_node"],
        ["name"],
        ondelete="SET NULL",
    )
    op.add_column(
        "jupyter_image_builds", sa.Column("cluster_node", sa.String(), nullable=True)
    )
    op.create_foreign_key(
        op.f("fk_jupyter_image_builds_cluster_node_cluster_nodes"),
        "jupyter_image_builds",
        "cluster_nodes",
        ["cluster_node"],
        ["name"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint(
        op.f("fk_jupyter_image_builds_cluster_node_cluster_nodes"),
        "jupyter_image_builds",
        type_="foreignkey",
    )
    op.drop_column("jupyter_image_builds", "cluster_node")
    op.drop_constraint(
        op.f("fk_environment_image_builds_cluster_node_cluster_nodes"),
        "environment_image_builds",
        type_="foreignkey",
    )
    op.drop_column("environment_image_builds", "cluster_node")
