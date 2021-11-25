"""empty message

Revision ID: 00e31eec40c6
Revises: 8feeb577ca3f
Create Date: 2021-11-10 12:35:38.097364

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "00e31eec40c6"
down_revision = "8feeb577ca3f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "client_heartbeats",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column(
            "timestamp",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_client_heartbeats")),
    )
    op.create_index(
        op.f("ix_client_heartbeats_timestamp"),
        "client_heartbeats",
        ["timestamp"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_client_heartbeats_timestamp"), table_name="client_heartbeats"
    )
    op.drop_table("client_heartbeats")
