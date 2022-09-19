"""Add jupyter_image_on_nodes table.

Revision ID: ae9940ff7e51
Revises: 1e0b0493bd6f
Create Date: 2022-08-12 10:02:59.863860

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "ae9940ff7e51"
down_revision = "1e0b0493bd6f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "jupyter_image_on_nodes",
        sa.Column("jupyter_image_tag", sa.Integer(), nullable=False),
        sa.Column("node_name", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["jupyter_image_tag"],
            ["jupyter_images.tag"],
            name=op.f("fk_jupyter_image_on_nodes_jupyter_image_tag_jupyter_images"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["node_name"],
            ["cluster_nodes.name"],
            name=op.f("fk_jupyter_image_on_nodes_node_name_cluster_nodes"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "jupyter_image_tag", "node_name", name=op.f("pk_jupyter_image_on_nodes")
        ),
    )


def downgrade():
    op.drop_table("jupyter_image_on_nodes")
