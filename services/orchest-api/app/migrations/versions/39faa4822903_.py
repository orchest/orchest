"""Create settings table.

Revision ID: 39faa4822903
Revises: 11462a4539f6
Create Date: 2022-04-07 13:38:04.278785

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "39faa4822903"
down_revision = "11462a4539f6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "settings",
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint("name", name=op.f("pk_settings")),
    )


def downgrade():
    op.drop_table("settings")
