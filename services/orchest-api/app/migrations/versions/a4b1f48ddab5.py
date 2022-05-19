"""Add OneOffJobUpdateEvent, CronJobUpdateEvent and related event_types

Revision ID: a4b1f48ddab5
Revises: a863be01327d
Create Date: 2022-05-17 12:47:18.027113

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a4b1f48ddab5"
down_revision = "a863be01327d"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        INSERT INTO event_types (name) values
        ('project:cron-job:updated'),
        ('project:one-off-job:updated')
        ;
        """
    )
    pass


def downgrade():
    pass
