"""Merge branched schema migrations

Revision ID: b917c97bac65
Revises: 01f11a3541cc, 166e07b0e9f1
Create Date: 2022-09-14 13:30:16.338192

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b917c97bac65"
down_revision = ("01f11a3541cc", "166e07b0e9f1")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
