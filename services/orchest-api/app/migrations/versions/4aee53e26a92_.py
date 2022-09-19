"""Merge branching schema migrations

Revision ID: 4aee53e26a92
Revises: ab6e402016c7, b917c97bac65
Create Date: 2022-09-19 11:40:58.144924

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "4aee53e26a92"
down_revision = ("ab6e402016c7", "b917c97bac65")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
