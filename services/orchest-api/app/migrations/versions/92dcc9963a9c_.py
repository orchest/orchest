"""Add CronJobEvent and CronJobPipelineRunEvent models and event types

Revision ID: 92dcc9963a9c
Revises: 814961a3d525
Create Date: 2022-04-25 09:29:37.229886

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "92dcc9963a9c"
down_revision = "814961a3d525"
branch_labels = None
depends_on = None


def upgrade():
    # Note the lack of ('project:cron-job:succeeded'), that's because
    # cronjobs never succeed.
    op.execute(
        """
        INSERT INTO event_types (name) values
        ('project:cron-job:created'),
        ('project:cron-job:started'),
        ('project:cron-job:deleted'),
        ('project:cron-job:cancelled'),
        ('project:cron-job:failed'),
        ('project:cron-job:paused'),
        ('project:cron-job:unpaused'),
        ('project:cron-job:run:started'),
        ('project:cron-job:run:succeeded'),
        ('project:cron-job:run:failed'),
        ('project:cron-job:run:pipeline-run:created'),
        ('project:cron-job:run:pipeline-run:started'),
        ('project:cron-job:run:pipeline-run:cancelled'),
        ('project:cron-job:run:pipeline-run:failed'),
        ('project:cron-job:run:pipeline-run:deleted'),
        ('project:cron-job:run:pipeline-run:succeeded')
        ;
        """
    )
    pass


def downgrade():
    pass
