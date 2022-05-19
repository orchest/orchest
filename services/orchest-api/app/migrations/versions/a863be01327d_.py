"""Add Pipeline.name field

Revision ID: a863be01327d
Revises: 268b3e08cb46
Create Date: 2022-05-17 11:03:15.153821

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a863be01327d"
down_revision = "268b3e08cb46"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "pipelines",
        sa.Column(
            "name",
            sa.String(length=255),
            server_default=sa.text("'Pipeline'"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("pipelines", "name")
