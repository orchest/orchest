"""Add environment_image_on_nodes table.

Revision ID: 991b8f367bec
Revises: ebc2d3435205
Create Date: 2022-08-12 09:53:30.588354

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "991b8f367bec"
down_revision = "ebc2d3435205"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "environment_image_on_nodes",
        sa.Column("project_uuid", sa.String(length=36), nullable=False),
        sa.Column("environment_uuid", sa.String(length=36), nullable=False),
        sa.Column("environment_image_tag", sa.Integer(), nullable=False),
        sa.Column("node_name", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_uuid", "environment_uuid", "environment_image_tag"],
            [
                "environment_images.project_uuid",
                "environment_images.environment_uuid",
                "environment_images.tag",
            ],
            name=op.f(
                "fk_environment_image_on_nodes_project_uuid_environment_uuid_environment_image_tag_environment_images"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "project_uuid",
            "environment_uuid",
            "environment_image_tag",
            "node_name",
            name=op.f("pk_environment_image_on_nodes"),
        ),
    )


def downgrade():
    op.drop_table("environment_image_on_nodes")
