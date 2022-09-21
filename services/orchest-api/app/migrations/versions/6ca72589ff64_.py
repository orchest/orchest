"""Remove JupyterImage.digest

Revision ID: 6ca72589ff64
Revises: c883daa39e3e
Create Date: 2022-08-23 12:34:16.301250

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "6ca72589ff64"
down_revision = "c883daa39e3e"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index("ix_jupyter_images_digest", table_name="jupyter_images")
    op.drop_column("jupyter_images", "digest")


def downgrade():
    op.add_column(
        "jupyter_images",
        sa.Column("digest", sa.VARCHAR(length=71), autoincrement=False, nullable=False),
    )
    op.create_index(
        "ix_jupyter_images_digest", "jupyter_images", ["digest"], unique=False
    )
