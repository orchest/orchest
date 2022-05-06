"""Add Delivery.notification_payload, make event FK nullable

Revision ID: dfe5c529e6da
Revises: 00ed420c6abf
Create Date: 2022-05-02 11:13:36.074151

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "dfe5c529e6da"
down_revision = "00ed420c6abf"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "deliveries",
        sa.Column(
            "notification_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
    )
    op.alter_column(
        "deliveries", "event", existing_type=postgresql.UUID(), nullable=True
    )
    op.drop_constraint("fk_deliveries_event_events", "deliveries", type_="foreignkey")
    op.create_foreign_key(
        op.f("fk_deliveries_event_events"),
        "deliveries",
        "events",
        ["event"],
        ["uuid"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint(
        op.f("fk_deliveries_event_events"), "deliveries", type_="foreignkey"
    )
    op.create_foreign_key(
        "fk_deliveries_event_events",
        "deliveries",
        "events",
        ["event"],
        ["uuid"],
        ondelete="CASCADE",
    )
    op.alter_column(
        "deliveries", "event", existing_type=postgresql.UUID(), nullable=False
    )
    op.drop_column("deliveries", "notification_payload")
