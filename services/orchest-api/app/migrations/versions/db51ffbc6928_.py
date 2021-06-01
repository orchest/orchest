"""Add user_services to interactive_sessions

Revision ID: db51ffbc6928
Revises: bffbc3eef681
Create Date: 2021-05-31 12:33:59.691499

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "db51ffbc6928"
down_revision = "bffbc3eef681"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "interactive_sessions",
        sa.Column(
            "user_services", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )


def downgrade():
    op.drop_column("interactive_sessions", "user_services")
