import logging
from datetime import datetime, timezone

from sqlalchemy import desc
from sqlalchemy.orm import load_only

from _orchest.internals.two_phase_executor import TwoPhaseExecutor
from app.apis.namespace_jobs import RunJob
from app.connections import db
from app.models import Job


class Scheduler:
    @classmethod
    def check_for_jobs_to_be_scheduled(cls, app):

        logger = logging.getLogger("job-scheduler")

        now = datetime.now(timezone.utc)

        with app.app_context():
            jobs_to_run = (
                Job.query.options(
                    load_only(
                        "job_uuid",
                    )
                )
                .filter(
                    # Filter out jobs that do not have to run anymore.
                    Job.next_scheduled_time.isnot(None)
                )
                .filter(
                    # Jobs which have next_scheduled_time before now
                    # need to be scheduled.
                    now
                    > Job.next_scheduled_time
                )
                # Order by time difference descending, so that the job
                # which is more "behind" gets scheduled first.
                .order_by(desc(now - Job.next_scheduled_time))
                .all()
            )

            # Separate logic at the job level so that errors in one job
            # do not hinder other jobs. Transform jobs from ORM objects
            # to uuids since each TwoPhaseExecutor will commit the
            # transaction, making the jobs potentially stale.
            for job_uuid in [job.job_uuid for job in jobs_to_run]:
                try:
                    logger.info(f"Scheduling job {job_uuid}.")
                    with TwoPhaseExecutor(db.session) as tpe:
                        RunJob(tpe).transaction(job_uuid)
                except Exception as e:
                    logger.error(e)
