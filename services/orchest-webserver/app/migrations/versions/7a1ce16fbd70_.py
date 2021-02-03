"""Remove datasources

Revision ID: 7a1ce16fbd70
Revises: fba5d2815f9e
Create Date: 2021-02-03 15:16:05.016594

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "7a1ce16fbd70"
down_revision = "fba5d2815f9e"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table("datasources")


def downgrade():
    op.create_table(
        "datasources",
        sa.Column("name", sa.VARCHAR(length=255), autoincrement=False, nullable=False),
        sa.Column(
            "source_type", sa.VARCHAR(length=100), autoincrement=False, nullable=False
        ),
        sa.Column(
            "connection_details",
            postgresql.JSON(astext_type=sa.Text()),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "created",
            postgresql.TIMESTAMP(),
            server_default=sa.text("timezone('utc'::text, now())"),
            autoincrement=False,
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("name", name="pk_datasources"),
        sa.UniqueConstraint("name", name="uq_datasources_name"),
    )
