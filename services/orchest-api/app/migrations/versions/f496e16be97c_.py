"""

Revision ID: f496e16be97c
Revises: 11539451f894
Create Date: 2022-04-14 15:06:13.666708

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f496e16be97c"
down_revision = "11539451f894"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index(
        "ix_jupyter_image_builds_image_tag", table_name="jupyter_image_builds"
    )
    op.create_index(
        op.f("ix_jupyter_image_builds_image_tag"),
        "jupyter_image_builds",
        ["image_tag"],
        unique=True,
    )
    op.create_table(
        "jupyter_images",
        sa.Column("tag", sa.Integer(), nullable=False),
        sa.Column("digest", sa.String(length=71), nullable=False),
        sa.Column("base_image_version", sa.String(), nullable=False),
        sa.Column(
            "marked_for_removal", sa.Boolean(), server_default="False", nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["tag"],
            ["jupyter_image_builds.image_tag"],
            name=op.f("fk_jupyter_images_tag_jupyter_image_builds"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("tag", name=op.f("pk_jupyter_images")),
    )
    op.create_index(
        op.f("ix_jupyter_images_digest"), "jupyter_images", ["digest"], unique=False
    )
    op.create_index(
        op.f("ix_jupyter_images_marked_for_removal"),
        "jupyter_images",
        ["marked_for_removal"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_jupyter_images_marked_for_removal"), table_name="jupyter_images"
    )
    op.drop_index(op.f("ix_jupyter_images_digest"), table_name="jupyter_images")
    op.drop_table("jupyter_images")
    op.drop_index(
        op.f("ix_jupyter_image_builds_image_tag"), table_name="jupyter_image_builds"
    )
    op.create_index(
        "ix_jupyter_image_builds_image_tag",
        "jupyter_image_builds",
        ["image_tag"],
        unique=False,
    )
