import datetime
import enum
import logging
import os
from typing import Callable

import sqlalchemy
from flask.app import Flask

from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import analytics, models, utils
from app.connections import db

logger = logging.getLogger("job-scheduler")


class Scheduler:
    @staticmethod
    def handle_telemetry_heartbeat_signal(app: Flask, interval: int = 0) -> None:
        """Handles sending the telemetry heartbeat signal.

        The schedule is defined by the given interval. E.g.
        `interval=15` will cause this job to if 15 minutes have passed
        since the previous run.

        Args:
            interval: How much time should have passed after the
                previous execution of this job (in minutes). And thus an
                `interval=0` will execute the job right away.

        """
        return _handle_scheduler_job(
            models.SchedulerJobType.TELEMETRY_HEARTBEAT,
            interval,
            analytics.send_heartbeat_signal,
            app,
        )

    @staticmethod
    def handle_orchest_examples(app: Flask, interval: int = 0) -> None:
        """Handles fetching the Orchest examples to disk.

        The schedule is defined by the given interval. E.g.
        `interval=15` will cause this job to if 15 minutes have passed
        since the previous run.

        Args:
            interval: How much time should have passed after the
                previous execution of this job (in minutes). And thus an
                `interval=0` will execute the job right away.

        """
        return _handle_scheduler_job(
            models.SchedulerJobType.ORCHEST_EXAMPLES,
            interval,
            utils.fetch_orchest_examples_json_to_disk,
            app,
        )


def _handle_scheduler_job(
    job_type: enum.Enum, interval: int, handle_func: Callable, app: Flask
) -> None:
    try:
        with app.app_context():
            with TwoPhaseExecutor(db.session) as tpe:
                HandleSchedulerJob(tpe).transaction(
                    job_type, interval, handle_func, app
                )
    except sqlalchemy.exc.IntegrityError:
        logger.debug(f"SchedulerJob with type {job_type} already exists.")
        return


class HandleSchedulerJob(TwoPhaseFunction):
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

            # Offset in minutes to account for lag in the scheduler
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
                query.with_for_update()
                # The scheduler will wake up at exactly the right time,
                # we still check so that concurrent runs don't also
                # run the collateral.
                .filter(
                    now
                    >= models.SchedulerJob.timestamp + datetime.timedelta(minutes=dt)
                ).first()
            )

            # The row was previsouly locked and thus another worker
            # already handled the `handle_func`.
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
