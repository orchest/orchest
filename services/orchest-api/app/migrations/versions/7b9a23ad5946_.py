"""Add Project.name field

Revision ID: 7b9a23ad5946
Revises: ff549d6b66be
Create Date: 2022-04-28 11:50:13.304600

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "7b9a23ad5946"
down_revision = "ff549d6b66be"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "projects",
        sa.Column(
            "name",
            sa.String(length=255),
            server_default=sa.text("'Project'"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("projects", "name")
