"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
import os
from logging.config import dictConfig
from pprint import pformat

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, request
from flask_cors import CORS
from flask_migrate import Migrate
from sqlalchemy_utils import create_database, database_exists

from _orchest.internals import config as _config
from _orchest.internals import utils as _utils
from _orchest.internals.two_phase_executor import TwoPhaseExecutor
from app import utils
from app.apis import blueprint as api
from app.apis.namespace_environment_builds import AbortEnvironmentBuild
from app.apis.namespace_jobs import AbortJob
from app.apis.namespace_jupyter_builds import AbortJupyterBuild, CreateJupyterBuild
from app.apis.namespace_runs import AbortPipelineRun
from app.connections import db
from app.core.scheduler import Scheduler
from app.models import (
    EnvironmentBuild,
    InteractivePipelineRun,
    InteractiveSession,
    Job,
    JupyterBuild,
    NonInteractivePipelineRun,
)


def create_app(config_class=None, use_db=True, be_scheduler=False, to_migrate_db=False):
    """Create the Flask app and return it.

    Args:
        config_class: Configuration class. See orchest-api/app/config.
        use_db: If true, associate a database to the Flask app instance,
            which implies connecting to a given database and possibly
            creating such database and/or tables if they do not exist
            already. The reason to differentiate instancing the app
            through this argument is that the celery worker does not
            need to connect to the db that "belongs" to the orchest-api.
        be_scheduler: If true, a background thread will act as a job
            scheduler, according to the logic in core/scheduler. While
            Orchest runs, only a single process should be acting as
            scheduler.
        to_migrate_db: If True, then only initialize the DB so that the
            DB can be migrated.

    Returns:
        Flask.app
    """
    app = Flask(__name__)
    app.config.from_object(config_class)

    init_logging()

    # In development we want more verbose logging of every request.
    if os.getenv("FLASK_ENV") == "development":
        app = register_teardown_request(app)

    # Cross-origin resource sharing. Allow API to be requested from the
    # different microservices such as the webserver.
    CORS(app, resources={r"/*": {"origins": "*"}})

    if use_db:
        # Create the database if it does not exist yet. Roughly equal to
        # a "CREATE DATABASE IF NOT EXISTS <db_name>" call.
        if not database_exists(app.config["SQLALCHEMY_DATABASE_URI"]):
            create_database(app.config["SQLALCHEMY_DATABASE_URI"])

        db.init_app(app)

        # Necessary for db migrations.
        Migrate().init_app(app, db)

    # NOTE: In this case we want to return ASAP as otherwise the DB
    # might be called (inside this function) before it is migrated.
    if to_migrate_db:
        return app

    if use_db and not _utils.is_running_from_reloader():
        with app.app_context():
            # In case of running multiple gunicorn workers, we need to
            # ensure that cleanup is only run once. Therefore, we
            # attempt to create a directory first (which is an atomic
            # operation). The edge case of Flask development mode
            # running multiple threads is handled above using the
            # `is_running_from_reloader()` check.
            try:
                if app.config.get("TESTING", False):
                    # Do nothing.
                    # In case of tests we always want to run cleanup.
                    # Because every test will get a clean app, the same
                    # code should run for all tests.
                    pass
                else:
                    app.logger.debug("Trying to create /tmp/cleanup_done")
                    os.mkdir("/tmp/cleanup_done")
                    app.logger.info("/tmp/cleanup_done successfully created.")
            except FileExistsError:
                app.logger.info(
                    f"/tmp/cleanup_done exists. Skipping cleanup: {os.getpid()}."
                )
            else:
                app.logger.debug("Starting app initialization cleanup.")

                # NOTE: This cleanup code blocks the gunicorn worker
                # from handling requests, because it is required for the
                # app to be initialized. So make sure the cleanup is
                # quick! (Especially when running only a single gunicorn
                # worker as the entire orchest-api will become
                # unresponsive.)
                # In case of an ungraceful shutdown, these entities
                # could be in an invalid state, so they are deleted,
                # since for sure they are not running anymore.
                try:
                    InteractiveSession.query.delete()

                    # Delete old JupyterBuilds on start to avoid
                    # accumulation in the DB. Leave the latest such that
                    # the user can see details about the last executed
                    # build after restarting Orchest.
                    jupyter_builds = (
                        JupyterBuild.query.order_by(JupyterBuild.requested_time.desc())
                        .offset(1)
                        .all()
                    )

                    # Can't use offset and .delete in conjunction in
                    # sqlalchemy unfortunately.
                    for jupyer_build in jupyter_builds:
                        db.session.delete(jupyer_build)

                    db.session.commit()

                    # Fix interactive runs.
                    runs = InteractivePipelineRun.query.filter(
                        InteractivePipelineRun.status.in_(["PENDING", "STARTED"])
                    ).all()
                    with TwoPhaseExecutor(db.session) as tpe:
                        for run in runs:
                            AbortPipelineRun(tpe).transaction(run.uuid)

                    # Fix one off jobs (and their pipeline runs).
                    jobs = Job.query.filter_by(schedule=None, status="STARTED").all()
                    with TwoPhaseExecutor(db.session) as tpe:
                        for job in jobs:
                            AbortJob(tpe).transaction(job.uuid)

                    # This is to fix the state of cron jobs pipeline
                    # runs.
                    runs = NonInteractivePipelineRun.query.filter(
                        NonInteractivePipelineRun.status.in_(["STARTED"])
                    ).all()
                    with TwoPhaseExecutor(db.session) as tpe:
                        for run in runs:
                            AbortPipelineRun(tpe).transaction(run.uuid)

                    # Fix env builds.
                    builds = EnvironmentBuild.query.filter(
                        EnvironmentBuild.status.in_(["PENDING", "STARTED"])
                    ).all()
                    with TwoPhaseExecutor(db.session) as tpe:
                        for build in builds:
                            AbortEnvironmentBuild(tpe).transaction(build.uuid)

                    # Fix jupyter builds.
                    builds = JupyterBuild.query.filter(
                        JupyterBuild.status.in_(["PENDING", "STARTED"])
                    ).all()
                    with TwoPhaseExecutor(db.session) as tpe:
                        for build in builds:
                            AbortJupyterBuild(tpe).transaction(build.uuid)

                    # Trigger a build of JupyterLab if no JupyterLab
                    # image is found for this version and JupyterLab
                    # setup_script is non-empty.
                    trigger_conditional_jupyter_build(app)

                    # Make environments unavailable to a user after an
                    # update.
                    utils.process_stale_environment_images()

                    # Remove dangling Orchest images, mostly useful
                    # after an update.
                    utils.delete_dangling_orchest_images()

                except Exception as e:
                    app.logger.error("Cleanup failed")
                    app.logger.error(e)

    # Create a background scheduler (in a daemon thread) for every
    # gunicorn worker. The individual schedulers do not cause duplicate
    # execution because all jobs of the all the schedulers read state
    # from the same DB and lock rows they are handling (using a
    # `with_for_update`).
    # In case of Flask development mode, every child process will get
    # its own scheduler.
    if be_scheduler:
        # Create a scheduler and have the scheduling logic running
        # periodically.
        app.logger.info("Creating a backgroundscheduler in a daemon thread.")
        scheduler = BackgroundScheduler(
            job_defaults={
                # Infinite amount of grace time, so that if a task
                # cannot be instantly executed (e.g. if the webserver is
                # busy) then it will eventually be.
                "misfire_grace_time": 2 ** 31,
                "coalesce": False,
                # So that the same job can be in the queue an infinite
                # amount of times, e.g. for concurrent requests issuing
                # the same tasks.
                "max_instances": 2 ** 31,
            },
        )

        app.config["SCHEDULER"] = scheduler
        scheduler.start()
        scheduler.add_job(
            # Locks rows it is processing.
            Scheduler.check_for_jobs_to_be_scheduled,
            "interval",
            seconds=app.config["SCHEDULER_INTERVAL"],
            args=[app],
        )

    # Register blueprints at the end to avoid issues when migrating the
    # DB. When registering a blueprint the DB schema is also registered
    # and so the DB migration should happen before it..
    app.register_blueprint(api, url_prefix="/api")

    return app


def init_logging():
    logging_config = {
        "version": 1,
        "formatters": {
            "verbose": {
                "format": (
                    "%(levelname)s:%(name)s:%(filename)s - [%(asctime)s] - %(message)s"
                ),
                "datefmt": "%d/%b/%Y %H:%M:%S",
            },
            "minimal": {
                "format": ("%(levelname)s:%(name)s:%(filename)s - %(message)s"),
                "datefmt": "%d/%b/%Y %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
                "class": "logging.StreamHandler",
                "formatter": "verbose",
            },
            "console-minimal": {
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
                "class": "logging.StreamHandler",
                "formatter": "minimal",
            },
        },
        "root": {
            "handlers": ["console"],
            "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
        },
        "loggers": {
            # NOTE: this is the name of the Flask app, since we use
            # ``__name__``. Using ``__name__`` is required for the app
            # to function correctly. See:
            # https://blog.miguelgrinberg.com/post/why-do-we-pass-name-to-the-flask-class
            __name__: {
                "handlers": ["console"],
                "propagate": False,
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
            "alembic": {
                "handlers": ["console"],
                "level": "WARNING",
            },
            "werkzeug": {
                # NOTE: Werkzeug automatically creates a handler at the
                # level of its logger if none is defined.
                "level": "INFO",
                "handlers": ["console-minimal"],
            },
            "gunicorn": {
                "handlers": ["console"],
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
            "orchest-lib": {
                "handlers": ["console"],
                "propagate": False,
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
            "job-scheduler": {
                "handlers": ["console"],
                "propagate": False,
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
            "apscheduler": {
                "handlers": ["console"],
                "propagate": False,
                "level": "WARNING",
            },
        },
    }

    dictConfig(logging_config)


def trigger_conditional_jupyter_build(app):
    # Use early return to satisfy all conditions for
    # triggering a build.

    # check if Jupyter setup_script is non-empty
    jupyter_setup_script = os.path.join("/userdir", _config.JUPYTER_SETUP_SCRIPT)
    if os.path.isfile(jupyter_setup_script):
        with open(jupyter_setup_script, "r") as file:
            if len(file.read()) == 0:
                return
    else:
        return

    user_jupyer_server_image = _config.JUPYTER_IMAGE_NAME
    if utils.get_environment_image_docker_id(user_jupyer_server_image) is not None:
        return

    try:
        with TwoPhaseExecutor(db.session) as tpe:
            CreateJupyterBuild(tpe).transaction()
    except Exception:
        app.logger.error("Failed to build Jupyter image")


def register_teardown_request(app):
    """Register functions to happen after every request to the app."""

    @app.after_request
    def teardown(response):
        app.logger.debug(
            "%s %s %s\n[Request object]: %s",
            request.method,
            request.path,
            response.status,
            pformat(request.get_json()),
        )
        return response

    return app
