"""Add JupyterImageBuild.image_tag

Revision ID: 11539451f894
Revises: 4694f9241649
Create Date: 2022-04-14 14:35:43.360670

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "11539451f894"
down_revision = "4694f9241649"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "jupyter_image_builds", sa.Column("image_tag", sa.Integer(), nullable=True)
    )
    op.create_index(
        op.f("ix_jupyter_image_builds_image_tag"),
        "jupyter_image_builds",
        ["image_tag"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_jupyter_image_builds_image_tag"), table_name="jupyter_image_builds"
    )
    op.drop_column("jupyter_image_builds", "image_tag")
