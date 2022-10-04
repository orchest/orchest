"""empty message

Revision ID: c883daa39e3e
Revises: 55a5e9795a44
Create Date: 2022-08-22 09:06:46.890899

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c883daa39e3e"
down_revision = "55a5e9795a44"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        op.f(
            "ix_environment_images_marked_for_removal_environment_images_stored_in_registry"
        ),
        "environment_images",
        ["marked_for_removal", "stored_in_registry"],
        unique=False,
    )
    op.create_index(
        op.f("ix_jupyter_images_marked_for_removal_jupyter_images_stored_in_registry"),
        "jupyter_images",
        ["marked_for_removal", "stored_in_registry"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_jupyter_images_marked_for_removal_jupyter_images_stored_in_registry"),
        table_name="jupyter_images",
    )
    op.drop_index(
        op.f(
            "ix_environment_images_marked_for_removal_environment_images_stored_in_registry"
        ),
        table_name="environment_images",
    )
