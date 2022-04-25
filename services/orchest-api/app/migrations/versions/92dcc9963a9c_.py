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
    # Note the lack of ('project:cronjob:succeeded'), that's because
    # cronjobs never succeed.
    op.execute(
        """
        INSERT INTO event_types (name) values
        ('project:cronjob:created'),
        ('project:cronjob:started'),
        ('project:cronjob:deleted'),
        ('project:cronjob:cancelled'),
        ('project:cronjob:failed'),
        ('project:cronjob:paused'),
        ('project:cronjob:unpaused'),
        ('project:cronjob:run:started'),
        ('project:cronjob:run:succeeded'),
        ('project:cronjob:run:failed'),
        ('project:cronjob:run:pipeline-run:created'),
        ('project:cronjob:run:pipeline-run:started'),
        ('project:cronjob:run:pipeline-run:cancelled'),
        ('project:cronjob:run:pipeline-run:failed'),
        ('project:cronjob:run:pipeline-run:deleted'),
        ('project:cronjob:run:pipeline-run:succeeded')
        ;
        """
    )
    pass


def downgrade():
    pass
