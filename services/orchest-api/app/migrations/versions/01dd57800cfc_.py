"""Add Webhook model

Revision ID: 01dd57800cfc
Revises: d0eac6764a55
Create Date: 2022-04-27 08:37:42.952388

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "01dd57800cfc"
down_revision = "d0eac6764a55"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "subscribers", sa.Column("type", sa.String(length=50), nullable=False)
    )
    op.add_column("subscribers", sa.Column("url", sa.String(), nullable=False))
    op.add_column(
        "subscribers", sa.Column("name", sa.String(length=100), nullable=False)
    )
    op.add_column("subscribers", sa.Column("verify_ssl", sa.Boolean(), nullable=False))
    op.add_column("subscribers", sa.Column("secret", sa.String(), nullable=False))
    op.add_column(
        "subscribers", sa.Column("content_type", sa.String(length=50), nullable=False)
    )


def downgrade():
    op.drop_column("subscribers", "content_type")
    op.drop_column("subscribers", "secret")
    op.drop_column("subscribers", "verify_ssl")
    op.drop_column("subscribers", "name")
    op.drop_column("subscribers", "url")
    op.drop_column("subscribers", "type")
