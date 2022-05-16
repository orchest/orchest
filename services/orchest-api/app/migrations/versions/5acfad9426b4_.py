"""Add Subscriber and Subscription models

Revision ID: 5acfad9426b4
Revises: 3fbff22943d6
Create Date: 2022-04-25 13:38:57.188708

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "5acfad9426b4"
down_revision = "3fbff22943d6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "subscribers",
        sa.Column("uuid", postgresql.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_subscribers")),
    )
    op.create_table(
        "subscriptions",
        sa.Column("uuid", postgresql.UUID(), nullable=False),
        sa.Column("subscriber_uuid", postgresql.UUID(), nullable=True),
        sa.Column("event_type", sa.String(length=50), nullable=True),
        sa.Column("type", sa.String(length=50), nullable=True),
        sa.Column("project_uuid", sa.String(length=36), nullable=True),
        sa.Column("job_uuid", sa.String(length=36), nullable=True),
        sa.ForeignKeyConstraint(
            ["event_type"],
            ["event_types.name"],
            name=op.f("fk_subscriptions_event_type_event_types"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["job_uuid"],
            ["jobs.uuid"],
            name=op.f("fk_subscriptions_job_uuid_jobs"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_uuid"],
            ["projects.uuid"],
            name=op.f("fk_subscriptions_project_uuid_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["subscriber_uuid"],
            ["subscribers.uuid"],
            name=op.f("fk_subscriptions_subscriber_uuid_subscribers"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_subscriptions")),
    )


def downgrade():
    op.drop_table("subscriptions")
    op.drop_table("subscribers")
