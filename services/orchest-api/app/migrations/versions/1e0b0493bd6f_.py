"""empty message

Revision ID: 1e0b0493bd6f
Revises: 991b8f367bec
Create Date: 2022-08-12 09:59:44.586457

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "1e0b0493bd6f"
down_revision = "991b8f367bec"
branch_labels = None
depends_on = None


def upgrade():
    op.create_foreign_key(
        op.f("fk_environment_image_on_nodes_node_name_cluster_nodes"),
        "environment_image_on_nodes",
        "cluster_nodes",
        ["node_name"],
        ["name"],
        ondelete="CASCADE",
    )


def downgrade():
    op.drop_constraint(
        op.f("fk_environment_image_on_nodes_node_name_cluster_nodes"),
        "environment_image_on_nodes",
        type_="foreignkey",
    )
