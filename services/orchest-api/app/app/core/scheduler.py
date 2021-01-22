"""Job scheduler.

Only one scheduler should be running. This means that if the orchest-api
is run as multiple processes then the scheduler needs to be factored out
as a stand alone process. The scheduler currently runs in a background
thread, and its invoked every orchest-api.config.SCHEDULER_INTERVAL
seconds.

The scheduler works by checking for which jobs are due to be run by
querying the database, which acts as the ground truth. The column of
interest to decide if a job should be scheduled is the
next_scheduled_time column, which is a UTC timestamp confronted with the
current UTC time.

Given a job that should have been run at time X, if Orchest was not
running at that time, the scheduler will run the job.
Given a recurring job that should have been run at time X, if Orchest
was not running at that time, the scheduler will run the job and set the
next_scheduled_time accordingly, in a way that all job runs that have
been missed will be scheduled. For example, given a recurring job with
cron string "* * * * *" (runs every minute), next_scheduled_time set to
12:00, if Orchest was offline and it's started at 12:10 the scheduler
will schedule the job run of 12:00, and will set the next_scheduled_time
to 12:01, which will in turn trigger another scheduling, which will
set the next_scheduled_time to 12:02, etc., all the way up to being on
par with all the runs that should have been scheduled. This way all
job runs that were missed will be scheduled and run.

"""
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

        with app.app_context():
            jobs_to_run = (
                Job.query.options(
                    load_only(
                        "job_uuid",
                        "schedule",
                        "next_scheduled_time",
                    )
                )
                # This is to avoid errors in case two schedulers are
                # running, which happens in dev mode.
                .with_for_update()
                # Filter out jobs that do not have to run anymore.
                .filter(Job.next_scheduled_time.isnot(None))
                # Jobs which have next_scheduled_time before now need to
                # to be scheduled.
                .filter(now > Job.next_scheduled_time)
                # Order by time difference descending, so that the job
                # which is more "behind" gets scheduled first.
                .order_by(desc(now - Job.next_scheduled_time)).all()
            )
            logger.info(f"found {len(jobs_to_run)} jobs to run")

            # Based on the type of Job (recurring or not) set the status
            # and next_scheduled_time. Note that for recurring jobs the
            # next scheduled time is computed starting from 'now', this
            # assumes that the scheduler runs every N seconds where N <
            # 60; otherwise some runs might be lost. If such assumption
            # cannot be made, the first time the scheduler runs (after
            # boot) the calculation must be made using 'now' to
            # aggregate lost jobs into 1, while all other scheduler
            # calls need to use the current value of next_scheduled_time
            # as a base.
            for job in jobs_to_run:
                if job.schedule is not None:
                    job.next_scheduled_time = croniter(job.schedule, now).get_next(
                        datetime
                    )
                else:
                    # One time jobs are not rescheduled again.
                    job.next_scheduled_time = None

            # Transform jobs from ORM objects to uuids since each we
            # are committing the transaction, making the jobs
            # potentially stale.
            jobs_to_run = [job.job_uuid for job in jobs_to_run]

            db.session.commit()

            # Separate logic at the job level so that errors in one job
            # do not hinder other jobs.
            for job_uuid in jobs_to_run:
                try:
                    logger.info(f"Scheduling job {job_uuid}.")
                    with TwoPhaseExecutor(db.session) as tpe:
                        RunJob(tpe).transaction(job_uuid)
                except Exception as e:
                    logger.error(e)
