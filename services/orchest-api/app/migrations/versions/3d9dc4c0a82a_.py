"""Add Event model

Revision ID: 3d9dc4c0a82a
Revises: 410e08270de4
Create Date: 2022-04-22 10:18:24.927456

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "3d9dc4c0a82a"
down_revision = "410e08270de4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "events",
        sa.Column("uuid", postgresql.UUID(), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=True),
        sa.Column(
            "timestamp",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["type"],
            ["event_types.name"],
            name=op.f("fk_events_type_event_types"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_events")),
    )


def downgrade():
    op.drop_table("events")
