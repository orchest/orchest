"""Add Delivery model

Revision ID: ff549d6b66be
Revises: 01dd57800cfc
Create Date: 2022-04-27 11:40:11.350286

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "ff549d6b66be"
down_revision = "01dd57800cfc"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "deliveries",
        sa.Column("uuid", postgresql.UUID(), nullable=False),
        sa.Column("event", postgresql.UUID(), nullable=False),
        sa.Column("deliveree", postgresql.UUID(), nullable=False),
        sa.Column("status", sa.String(length=15), nullable=False),
        sa.Column("n_delivery_attempts", sa.Integer(), nullable=False),
        sa.Column(
            "scheduled_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("delivered_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["deliveree"],
            ["subscribers.uuid"],
            name=op.f("fk_deliveries_deliveree_subscribers"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["event"],
            ["events.uuid"],
            name=op.f("fk_deliveries_event_events"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_deliveries")),
    )
    op.create_index(
        op.f("ix_deliveries_status_deliveries_scheduled_at"),
        "deliveries",
        ["status", "scheduled_at"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_deliveries_status_deliveries_scheduled_at"), table_name="deliveries"
    )
    op.drop_table("deliveries")
