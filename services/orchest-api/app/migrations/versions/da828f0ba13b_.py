"""Migrate jobs.total_scheduled_pipeline_runs values.


Revision ID: da828f0ba13b
Revises: 7c2f9f12f9ca
Create Date: 2021-12-21 15:11:58.657960

"""
from app.models import Job, NonInteractivePipelineRun

# revision identifiers, used by Alembic.
revision = "da828f0ba13b"
down_revision = "7c2f9f12f9ca"
branch_labels = None
depends_on = None


def upgrade():
    jobs = Job.query.all()
    # There is for sure a more elegant way.
    for job in jobs:
        count = NonInteractivePipelineRun.query.filter_by(job_uuid=job.uuid).count()
        if count is None:
            count = 0
        job.total_scheduled_pipeline_runs = count


def downgrade():
    Job.query.update({"total_scheduled_pipeline_runs": 0})
