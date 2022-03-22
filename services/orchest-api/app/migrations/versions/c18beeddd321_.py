"""empty message

Revision ID: c18beeddd321
Revises: 70744b366f91
Create Date: 2022-03-07 13:53:28.748339

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "c18beeddd321"
down_revision = "70744b366f91"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index("ix_environment_images_tag", table_name="environment_images")


def downgrade():
    op.create_index(
        "ix_environment_images_tag", "environment_images", ["tag"], unique=False
    )
