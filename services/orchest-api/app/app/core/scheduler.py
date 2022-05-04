"""Handles recurring jobs by assigning them to a given scheduler.

This implementation is in line with the scheduler of the webserver,
check its module docstring for more info.

"""
import datetime
import enum
import logging
import os
from typing import Callable

import sqlalchemy
from apscheduler.schedulers.background import BackgroundScheduler
from croniter import croniter
from flask.app import Flask
from sqlalchemy import desc
from sqlalchemy.orm import load_only

from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import models, utils
from app.apis.namespace_jobs import RunJob
from app.celery_app import make_celery
from app.connections import db
from app.core import environments

logger = logging.getLogger("job-scheduler")


class SchedulerJobType(enum.Enum):
    SCHEDULE_JOB_RUNS = "SCHEDULE_JOB_RUNS"
    PROCESS_IMAGES_FOR_DELETION = "PROCESS_IMAGES_FOR_DELETION"
    PROCESS_NOTIFICATIONS_DELIVERIES = "PROCESS_NOTIFICATIONS_DELIVERIES"


def add_recurring_jobs_to_scheduler(
    scheduler: BackgroundScheduler, app: Flask, run_on_add=False
) -> None:
    """Adds recurring jobs to the given scheduler.

    Args:
        scheduler: Scheduler to which the jobs will be added.
        app: Flask app to read config values from such as the interval
            that is used for the recurring jobs.
        run_on_add: If True will try to run the jobs when added to the
            scheduler (it will still only run if the interval has
            passed).

    """
    jobs = Jobs()
    recurring_jobs = {
        "schedule job runs": {
            "allowed_to_run": True,
            "interval": app.config["SCHEDULER_INTERVAL"],
            "job_func": jobs.handle_schedule_job_runs,
        },
        "process images for deletion": {
            "allowed_to_run": True,
            "interval": app.config["IMAGES_DELETION_INTERVAL"],
            "job_func": jobs.handle_process_images_for_deletion,
        },
        "process notifications deliveries": {
            "allowed_to_run": True,
            "interval": app.config["NOTIFICATIONS_DELIVERIES_INTERVAL"],
            "job_func": jobs.handle_process_notifications_deliveries,
        },
    }

    for name, job in recurring_jobs.items():
        if job["allowed_to_run"]:
            app.logger.debug(f"Adding recurring job '{name}' to scheduler.")
            scheduler.add_job(
                job["job_func"],
                "interval",
                seconds=job["interval"],
                args=[app, job["interval"]],
            )

            if run_on_add:
                try:
                    # To prevent multiple gunicorn workers on app
                    # initialization to run the job, we still use the
                    # interval.
                    job["job_func"](app, job["interval"])
                except Exception:
                    app.logger.error(
                        f"Failed to do initial run of recurring job: '{name}'."
                    )


class Jobs:
    def __init__(self):
        pass

    def handle_schedule_job_runs(self, app: Flask, interval: int = 0) -> None:
        """Handles checking for job runs to be scheduled.

        The schedule is defined by the given interval. E.g.
        `interval=15` will cause this job to run if 15 seconds have
        passed since the previous run.

        Args:
            interval: How much time should have passed after the
                previous execution of this job (in seconds). And thus an
                `interval=0` will execute the job right away.

        """
        return self._handle_recurring_scheduler_job(
            SchedulerJobType.SCHEDULE_JOB_RUNS.value,
            interval,
            schedule_job_runs,
            app,
        )

    def handle_process_images_for_deletion(self, app: Flask, interval: int = 0) -> None:
        """Handles processing images for deletion."""
        return self._handle_recurring_scheduler_job(
            SchedulerJobType.PROCESS_IMAGES_FOR_DELETION.value,
            interval,
            process_images_for_deletion,
            app,
        )

    def handle_process_notifications_deliveries(
        self, app: Flask, interval: int = 0
    ) -> None:
        """Handles processing notifications deliveries for deletion."""
        return self._handle_recurring_scheduler_job(
            SchedulerJobType.PROCESS_NOTIFICATIONS_DELIVERIES.value,
            interval,
            process_notification_deliveries,
            app,
        )

    @staticmethod
    def _handle_recurring_scheduler_job(
        job_type: str, interval: int, handle_func: Callable, app: Flask
    ) -> None:
        try:
            with app.app_context():
                with TwoPhaseExecutor(db.session) as tpe:
                    _HandleRecurringSchedulerJob(tpe).transaction(
                        job_type, interval, handle_func, app
                    )
        except sqlalchemy.exc.IntegrityError:
            logger.debug(f"SchedulerJob with type {job_type} already exists.")
        except Exception:
            logger.error(f"Failed to run job with type: {job_type}.")


class _HandleRecurringSchedulerJob(TwoPhaseFunction):
    def _transaction(
        self, job_type: str, interval: int, handle_func: Callable, app: Flask
    ):
        self.collateral_kwargs["app"] = app
        self.collateral_kwargs["handle_func"] = handle_func
        self.collateral_kwargs["run_collateral"] = True

        query = models.SchedulerJob.query.filter_by(type=job_type)

        # Check whether there is already an entry in the DB, if not
        # then we need to create it.
        if query.first() is None:
            db.session.add(models.SchedulerJob(type=job_type))
        else:
            now = datetime.datetime.now(datetime.timezone.utc)

            # Offset in seconds to account for lag in the scheduler
            # when running jobs. E.g. execution X is slow and execution
            # X+1 is fast, causing X+1 to not handle the event as the
            # interval has not yet passed.
            epsilon = 0.1

            if interval > 0:
                # The task would always run and thus also for every
                # concurrent run. This is not what we want.
                assert epsilon < interval, "Offset too large."
                dt = interval - epsilon
            else:
                dt = 0

            job = (
                # Skip locked rows to prevent concurrent runs.
                query.with_for_update(skip_locked=True)
                # The scheduler will wake up at exactly the right time,
                # we still check so that slow concurrent runs don't also
                # run the collateral in case the row is no longer
                # locked.
                .filter(
                    now
                    >= models.SchedulerJob.timestamp + datetime.timedelta(seconds=dt)
                ).first()
            )

            # Another worker has already handled `handle_func`.
            if job is None:
                # Use kwarg instead of raising an error as an error
                # would be logged by the TPE.
                self.collateral_kwargs["run_collateral"] = False
                return

            job.timestamp = now

    def _collateral(
        self, app: Flask, handle_func: Callable, run_collateral: bool
    ) -> None:
        if not run_collateral:
            # Either the app has restarted and the interval has not
            # passed or another gunicorn worker has already executed it
            # and updated the timestamp.
            logger.debug(
                f"Not running SchedulerJob '{handle_func.__name__}' as its interval has"
                " not yet passed."
            )
        else:
            logger.info(
                f"SchedulerJob running {handle_func.__name__}: PID {os.getpid()}."
            )
            return handle_func(app)


def schedule_job_runs(app) -> None:
    """Checks for job runs to be scheduled.

    The scheduler works by checking for which jobs are due to be run by
    querying the database, which acts as the ground truth. The column of
    interest to decide if a job should be scheduled is the
    next_scheduled_time column, which is a UTC timestamp confronted with
    the current UTC time.

    Given a job that should have been run at time X, if Orchest was not
    running at that time, the scheduler will run the job.  Given a
    recurring job that should have been run at time X, if Orchest was
    not running at that time, the scheduler will run the job and set the
    next_scheduled_time accordingly, in a way that all job runs that
    have been missed will be scheduled. For example, given a recurring
    job with cron string "* * * * *" (runs every minute),
    next_scheduled_time set to 12:00, if Orchest was offline and it's
    started at 12:10 the scheduler will schedule the job run of 12:00,
    and will set the next_scheduled_time to 12:01, which will in turn
    trigger another scheduling, which will set the next_scheduled_time
    to 12:02, etc., all the way up to being on par with all the runs
    that should have been scheduled. This way all job runs that were
    missed will be scheduled and run.

    """

    logger = logging.getLogger("job-scheduler")

    now = datetime.datetime.now(datetime.timezone.utc)

    with app.app_context():
        query = (
            models.Job.query.options(
                load_only(
                    "uuid",
                    "schedule",
                    "next_scheduled_time",
                )
            )
            # Ignore drafts.
            .filter(models.Job.status != "DRAFT")
            # Filter out jobs that do not have to run anymore.
            .filter(models.Job.next_scheduled_time.isnot(None))
            # Jobs which have next_scheduled_time before now need to to
            # be scheduled.
            .filter(now > models.Job.next_scheduled_time)
            # Order by time difference descending, so that the job which
            # is more "behind" gets scheduled first.
            .order_by(desc(now - models.Job.next_scheduled_time))
        )

        jobs_to_run = query.all()

        if jobs_to_run:
            logger.info(f"found {len(jobs_to_run)} jobs to run")

        # Use one transaction per job, so errors in one job do not
        # hinder the others.
        for job in jobs_to_run:
            try:
                job = query.with_for_update().filter_by(uuid=job.uuid).first()
                # The job might have been paused in this tiny time
                # window.
                if job is None:
                    continue

                # Based on the type of Job (recurring or not) set the
                # status and next_scheduled_time. Note that for
                # recurring jobs the next scheduled time is computed
                # starting from "now", this assumes that the scheduler
                # runs every N seconds where N < 60; otherwise some runs
                # might be lost. If such assumption cannot be made, the
                # first time the scheduler runs (after boot) the
                # calculation must be made using "now" to aggregate lost
                # jobs into 1, while all other scheduler calls need to
                # use the current value of next_scheduled_time as a
                # base.  Note: we maintain correctness even if the
                # scheduler runs past the minute the job was scheduled
                # for.
                job.last_scheduled_time = job.next_scheduled_time
                if job.schedule is not None:
                    job.next_scheduled_time = croniter(job.schedule, now).get_next(
                        datetime.datetime
                    )
                else:
                    # One time jobs are not rescheduled again.
                    job.next_scheduled_time = None

                with TwoPhaseExecutor(db.session) as tpe:
                    logger.info(f"Scheduling job {job.uuid}.")
                    RunJob(tpe).transaction(job.uuid)

                db.session.commit()
            except Exception as e:
                logger.error(e)


def process_images_for_deletion(app) -> None:
    """Processes built images to find inactive ones.

    Goes through env images and marks the inactive ones for removal,
    moreover, if necessary, queues the celery task in charge of removing
    images from the registry.

    Note: this function should probably be moved in the scheduler module
    to be consistent with the scheduler module of the webserver, said
    module would need a bit of a refactoring.
    """
    with app.app_context():
        environments.mark_env_images_that_can_be_removed()
        utils.mark_custom_jupyter_images_to_be_removed()
        db.session.commit()

        # Don't queue the task if there are build tasks going, this is a
        # "cheap" way to avoid piling up multiple garbage collection
        # tasks while a build is ongoing.
        if db.session.query(
            db.session.query(models.EnvironmentImageBuild)
            .filter(models.EnvironmentImageBuild.status.in_(["PENDING", "STARTED"]))
            .exists()
        ).scalar():
            app.logger.info("Ongoing build, not queueing registry gc task.")
            return

        if db.session.query(
            db.session.query(models.JupyterImageBuild)
            .filter(models.JupyterImageBuild.status.in_(["PENDING", "STARTED"]))
            .exists()
        ).scalar():
            app.logger.info("Ongoing build, not queueing registry gc task.")
            return

        celery = make_celery(app)
        app.logger.info("Sending registry garbage collection task.")
        res = celery.send_task(name="app.core.tasks.registry_garbage_collection")
        res.forget()


def process_notification_deliveries(app) -> None:
    with app.app_context():
        app.logger.debug("Sending process notifications deliveries task.")
        celery = make_celery(app)
        res = celery.send_task(name="app.core.tasks.process_notifications_deliveries")
        res.forget()
