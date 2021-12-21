"""Migrate jobs.total_scheduled_pipeline_runs values.


Revision ID: da828f0ba13b
Revises: 7c2f9f12f9ca
Create Date: 2021-12-21 15:11:58.657960

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "da828f0ba13b"
down_revision = "7c2f9f12f9ca"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        WITH tmp as (
        SELECT jobs.uuid, runs.count FROM jobs JOIN (SELECT job_uuid, count(*) FROM
        pipeline_runs WHERE job_uuid IS NOT NULL GROUP BY job_uuid) AS runs ON
        jobs.uuid = runs.job_uuid)
        UPDATE jobs
        SET total_scheduled_pipeline_runs = tmp.count
        FROM tmp
        WHERE jobs.uuid = tmp.uuid;
        """
    )


def downgrade():
    op.execute("UPDATE jobs set total_scheduled_pipeline_runs = 0;")
