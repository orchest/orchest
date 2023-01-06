"""Handles recurring jobs by assigning them to a given scheduler.

This implementation was initially in line with the scheduler of the
orchest-webserver, but ended up differentiating on the schema of a task
record, while in the webserver there is a record for each job type, here
we have a record for each run of a job, this is needed to keep track of
the state of some jobs that can interfere with other activities, in
particular, registry garbage collection and image pushes to the
registry.

When the scheduler starts a job it takes care of setting it's state to
"STARTED", upon success or failure it is responsibility of the job logic
to set a SUCCEEDED or FAILED status, by using the functions provided by
this module.

"""
import datetime
import enum
import logging
import os
import uuid
from typing import Callable, Optional

import sqlalchemy
from apscheduler.schedulers.background import BackgroundScheduler
from croniter import croniter
from flask.app import Flask
from sqlalchemy import desc
from sqlalchemy.orm import load_only

from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import models, utils
from app.apis.namespace_jobs import RunJob
from app.connections import db
from app.core import environments

logger = logging.getLogger("job-scheduler")


class SchedulerJobType(enum.Enum):
    CLEANUP_OLD_SCHEDULER_JOB_RECORDS = "CLEANUP_OLD_SCHEDULER_JOB_RECORDS"
    PROCESS_IMAGES_FOR_DELETION = "PROCESS_IMAGES_FOR_DELETION"
    PROCESS_NOTIFICATIONS_DELIVERIES = "PROCESS_NOTIFICATIONS_DELIVERIES"
    SCHEDULE_JOB_RUNS = "SCHEDULE_JOB_RUNS"


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
        "cleanup_old_scheduler_job_records": {
            "allowed_to_run": True,
            "interval": app.config["CLEANUP_OLD_SCHEDULER_JOB_RECORDS_INTERVAL"],
            "job_func": jobs.handle_cleanup_old_scheduler_job_records,
        },
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

    def handle_cleanup_old_scheduler_job_records(
        self, app: Flask, interval: int = 0
    ) -> None:
        """Cleans up scheduler job records to avoid filling up the db.

        The schedule is defined by the given interval. E.g.
        `interval=15` will cause this job to run if 15 seconds have
        passed since the previous run.

        Args:
            interval: How much time should have passed after the
                previous execution of this job (in seconds). And thus an
                `interval=0` will execute the job right away.

        """
        return self._handle_recurring_scheduler_job(
            SchedulerJobType.CLEANUP_OLD_SCHEDULER_JOB_RECORDS.value,
            interval,
            cleanup_old_scheduler_job_records,
            app,
        )

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
        except Exception:
            logger.error(f"Failed to run job with type: {job_type}.")


class _HandleRecurringSchedulerJob(TwoPhaseFunction):
    def _transaction(
        self, job_type: str, interval: int, handle_func: Callable, app: Flask
    ):
        self.collateral_kwargs["app"] = app
        self.collateral_kwargs["handle_func"] = handle_func
        self.collateral_kwargs["run_collateral"] = False
        self.collateral_kwargs["task_uuid"] = None

        # Lock on the latest job of the same type to avoid race
        # conditions where multiple schedulers could schedule the same
        # job. We use nowait=True so that if a concurrent scheduler
        # runs it won't run a job.
        try:
            latest_job_of_type = (
                models.SchedulerJob.query.with_for_update(nowait=True)
                .filter(models.SchedulerJob.type == job_type)
                .order_by(desc(models.SchedulerJob.started_time))
                .first()
            )
        except sqlalchemy.exc.OperationalError:
            logger.info(
                "A scheduler is running concurrently and took priority in running "
                f"a {job_type} job."
            )
            return

        # Offset in seconds to account for lag in the scheduler when
        # running jobs. E.g. execution X is slow and execution X+1 is
        # fast, causing X+1 to not handle the event as the interval has
        # not yet passed.
        if interval > 0:
            epsilon = 0.1
            # The task would always run and thus also for every
            # concurrent run. This is not what we want.
            assert epsilon < interval, "Offset too large."
            dt = interval - epsilon
        else:
            dt = 0

        if latest_job_of_type is None or datetime.datetime.now(
            datetime.timezone.utc
        ) >= latest_job_of_type.started_time + datetime.timedelta(seconds=dt):
            task_uuid = str(uuid.uuid4())
            db.session.add(
                models.SchedulerJob(uuid=task_uuid, type=job_type, status="STARTED")
            )
            self.collateral_kwargs["run_collateral"] = True
            self.collateral_kwargs["task_uuid"] = task_uuid

    def _collateral(
        self,
        app: Flask,
        handle_func: Callable,
        run_collateral: bool,
        task_uuid: Optional[str],
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
            logger.debug(
                f"SchedulerJob running {handle_func.__name__}: PID {os.getpid()}."
            )
            try:
                handle_func(app, task_uuid)
            except Exception as e:
                logger.error(e)
                notify_scheduled_job_failed(task_uuid)
                raise e


def cleanup_old_scheduler_job_records(app, task_uuid: str) -> None:
    logger = logging.getLogger("cleanup_old_scheduler_job_records")

    now = datetime.datetime.now(datetime.timezone.utc)

    with app.app_context():

        logger.info("Deleting old records")
        for job_type in SchedulerJobType:
            records_of_job_type_to_keep = (
                db.session.query(models.SchedulerJob)
                .filter(models.SchedulerJob.type == job_type.value)
                .with_entities(
                    models.SchedulerJob.uuid,
                )
                .order_by(desc(models.SchedulerJob.started_time))
                .limit(500)
                .subquery()
            )
            # Can't use limit and delete in the same query.
            models.SchedulerJob.query.filter(
                models.SchedulerJob.uuid.not_in(records_of_job_type_to_keep),
                models.SchedulerJob.type == job_type.value,
                models.SchedulerJob.uuid != task_uuid,
            ).delete(synchronize_session="fetch")

        logger.info("Fixing jobs that failed to report back their status.")
        models.SchedulerJob.query.filter(
            models.SchedulerJob.started_time < (now - datetime.timedelta(hours=1)),
            models.SchedulerJob.status == "STARTED",
        ).update({"status": "FAILED"})
        db.session.commit()

        notify_scheduled_job_succeeded(task_uuid)


def schedule_job_runs(app, task_uuid: str) -> None:
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

        if utils.OrchestSettings()["PAUSED"]:
            logger.info("Orchest is paused, skipping job scheduling.")
            return

        query = (
            models.Job.query.options(
                load_only(
                    "uuid",
                    "schedule",
                    "next_scheduled_time",
                )
            ).filter(models.Job.status.in_(["PENDING", "STARTED"]))
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

        notify_scheduled_job_succeeded(task_uuid)


def process_images_for_deletion(app, task_uuid: str) -> None:
    """Processes built images to find inactive ones.

    Goes through env images and marks the inactive ones for removal,
    moreover, if necessary, queues the celery task in charge of removing
    images from the registry.

    Note: this function should probably be moved in the scheduler module
    to be consistent with the scheduler module of the webserver, said
    module would need a bit of a refactoring.
    """
    with app.app_context():

        try:
            environments.mark_env_images_that_can_be_removed()
            utils.mark_custom_jupyter_images_to_be_removed()
            db.session.commit()

            # Don't queue the task if there are build tasks going, this
            # is a "cheap" way to avoid piling up multiple garbage
            # collection tasks while a build is ongoing.
            if db.session.query(
                db.session.query(models.EnvironmentImageBuild)
                .filter(models.EnvironmentImageBuild.status.in_(["PENDING", "STARTED"]))
                .exists()
            ).scalar():
                app.logger.info("Ongoing build, not queueing registry gc task.")
                notify_scheduled_job_succeeded(task_uuid)
                return

            if db.session.query(
                db.session.query(models.JupyterImageBuild)
                .filter(models.JupyterImageBuild.status.in_(["PENDING", "STARTED"]))
                .exists()
            ).scalar():
                app.logger.info("Ongoing build, not queueing registry gc task.")
                notify_scheduled_job_succeeded(task_uuid)
                return

            celery = app.config["CELERY"]
            app.logger.info("Sending registry garbage collection task.")
            res = celery.send_task(
                name="app.core.tasks.registry_garbage_collection", task_id=task_uuid
            )
            res.forget()
        except Exception as e:
            logger.error(e)
            notify_scheduled_job_failed(task_uuid)


def process_notification_deliveries(app, task_uuid: str) -> None:
    with app.app_context():
        app.logger.debug("Sending process notifications deliveries task.")
        celery = app.config["CELERY"]
        res = celery.send_task(
            name="app.core.tasks.process_notifications_deliveries", task_id=task_uuid
        )
        res.forget()


def notify_scheduled_job_succeeded(uuid: str) -> None:
    models.SchedulerJob.query.with_for_update().filter(
        models.SchedulerJob.uuid == uuid
    ).update({"status": "SUCCEEDED", "finished_time": datetime.datetime.utcnow()})
    db.session.commit()


def notify_scheduled_job_failed(uuid: str) -> None:
    models.SchedulerJob.query.with_for_update().filter(
        models.SchedulerJob.uuid == uuid
    ).update({"status": "FAILED", "finished_time": datetime.datetime.utcnow()})
    db.session.commit()


def is_running(job_type: SchedulerJobType) -> bool:
    return db.session.query(
        db.session.query(models.SchedulerJob)
        .filter(
            models.SchedulerJob.type == job_type.value,
            models.SchedulerJob.status == "STARTED",
        )
        .exists()
    ).scalar()
