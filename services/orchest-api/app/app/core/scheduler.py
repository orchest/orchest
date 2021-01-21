import logging
from datetime import datetime, timezone

from croniter import croniter
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

        # In case two schedulers are running, for whatever reason.
        # https://docs.sqlalchemy.org/en/13/orm/query.html#sqlalchemy.orm.query.Query.with_for_update
        # https://www.postgresql.org/docs/9.0/sql-select.html#SQL-FOR-UPDATE-SHARE
        with app.app_context():
            jobs_to_run = (
                Job.query.options(
                    load_only(
                        "job_uuid",
                        "schedule",
                        "next_scheduled_time",
                        "total_scheduled_executions",
                    )
                )
                .with_for_update()
                .filter(
                    # Filter out jobs that do not have to run anymore.
                    Job.next_scheduled_time.isnot(None)
                )
                .filter(
                    # Jobs which have next_scheduled_time before now
                    # need to be scheduled.
                    now
                    > Job.next_scheduled_time
                    # Order by time difference descending, so that the
                    # job which is more "behind" gets scheduled first.
                )
                .order_by(desc(now - Job.next_scheduled_time))
                .all()
            )

            # Separate logic at the job level so that errors in one job
            # do not hinder other jobs.
            for job in jobs_to_run:
                try:
                    logger.info(f"Scheduling job {job.job_uuid}.")

                    # If it has no schedule it needs be run once, so the
                    # next_scheduled_time must be set to NULL.
                    if job.schedule is None:
                        job.next_scheduled_time = None
                    else:
                        # Else we need to decide what's the next
                        # scheduled time, based on the cron schedule and
                        # this scheduled time.
                        job.next_scheduled_time = croniter(
                            job.schedule, job.next_scheduled_time
                        ).get_next(datetime)

                    job.total_scheduled_executions += 1

                    # We want to commit before calling RunJob because
                    # failing to RunJob should not imply that the
                    # scheduling has not taken place.
                    db.session.commit()

                    with TwoPhaseExecutor(db.session) as tpe:
                        RunJob(tpe).transaction(job.job_uuid)
                except Exception as e:
                    logger.error(e)
