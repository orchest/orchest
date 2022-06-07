"""Add partial unique indexes to subscription models

Revision ID: aa7e3a012836
Revises: 355762ae407e
Create Date: 2022-06-06 11:06:18.480063

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "aa7e3a012836"
down_revision = "355762ae407e"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "plain_subscription_uniqueness",
        "subscriptions",
        ["subscriber_uuid", "event_type"],
        unique=True,
        postgresql_where=sa.text("type = 'globally_scoped_subscription'"),
    )
    op.create_index(
        "project_job_subscription_uniqueness",
        "subscriptions",
        ["subscriber_uuid", "event_type", "project_uuid", "job_uuid"],
        unique=True,
        postgresql_where=sa.text("type = 'project_job_specific_subscription'"),
    )
    op.create_index(
        "project_subscription_uniqueness",
        "subscriptions",
        ["subscriber_uuid", "event_type", "project_uuid"],
        unique=True,
        postgresql_where=sa.text("type = 'project_specific_subscription'"),
    )


def downgrade():
    op.drop_index(
        "project_subscription_uniqueness",
        table_name="subscriptions",
        postgresql_where=sa.text("type = 'project_specific_subscription'"),
    )
    op.drop_index(
        "project_job_subscription_uniqueness",
        table_name="subscriptions",
        postgresql_where=sa.text("type = 'project_job_specific_subscription'"),
    )
    op.drop_index(
        "plain_subscription_uniqueness",
        table_name="subscriptions",
        postgresql_where=sa.text("type = 'globally_scoped_subscription'"),
    )
