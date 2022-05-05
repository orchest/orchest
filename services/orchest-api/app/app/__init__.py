"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
import os
from logging.config import dictConfig
from pathlib import Path
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
from app.apis.namespace_environment_image_builds import AbortEnvironmentImageBuild
from app.apis.namespace_jobs import AbortJob
from app.apis.namespace_jupyter_image_builds import (
    AbortJupyterEnvironmentBuild,
    CreateJupyterEnvironmentBuild,
)
from app.apis.namespace_runs import AbortPipelineRun
from app.apis.namespace_sessions import StopInteractiveSession
from app.connections import db
from app.core.scheduler import add_recurring_jobs_to_scheduler
from app.models import (
    EnvironmentImageBuild,
    InteractivePipelineRun,
    InteractiveSession,
    Job,
    JupyterImageBuild,
    NonInteractivePipelineRun,
)
from config import CONFIG_CLASS


def create_app(
    config_class=None,
    use_db=True,
    be_scheduler=False,
    to_migrate_db=False,
    register_api=True,
):
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
        register_api: If api endpoints should be registered.

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

        with app.app_context():
            settings = utils.OrchestSettings()
            settings.save()
            app.config.update(settings.as_dict())

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
        add_recurring_jobs_to_scheduler(scheduler, app, run_on_add=True)
        scheduler.start()

        if not _utils.is_running_from_reloader():
            with app.app_context():
                trigger_conditional_jupyter_image_build(app)

    app.logger.info("Creating required directories for Orchest services.")
    create_required_directories()

    if register_api:
        # Register blueprints at the end to avoid issues when migrating
        # the DB. When registering a blueprint the DB schema is also
        # registered and so the DB migration should happen before it..
        app.register_blueprint(api, url_prefix="/api")

    return app


def create_required_directories() -> None:
    """Creates required directories by Orchest services.

    Should work fine when running multiple gunicorn workers.

    Note:
        It is very important, that this function is backwards compatible
        meaning that new directories can be added but no old directories
        can be (re)moved.

        Moreover, the function is invoked whenever the Flask app is
        started. To make sure that after updating the Flask app is still
        able to run correctly the directories need to be in the places
        it expects. Since a user could be updating from any older
        version we would have to support migration paths for all.
        Alternatively, we can stick to not introduce breaking changes
        and keep supporting old directory structures (whilst still
        adding new ones).

    """
    for path in [
        _config.USERDIR_DATA,
        _config.USERDIR_JOBS,
        _config.USERDIR_PROJECTS,
        _config.USERDIR_ENV_IMG_BUILDS,
        _config.USERDIR_JUPYTER_IMG_BUILDS,
        _config.USERDIR_JUPYTERLAB,
    ]:
        Path(path).mkdir(parents=True, exist_ok=True)


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


def trigger_conditional_jupyter_image_build(app):
    # Use early return to satisfy all conditions for
    # triggering a build.

    # check if Jupyter setup_script is non-empty
    jupyter_setup_script = os.path.join("/userdir", _config.JUPYTER_SETUP_SCRIPT)
    if os.path.isfile(jupyter_setup_script):
        with open(jupyter_setup_script, "r") as file:
            if len(file.read()) == 0:
                app.logger.info(
                    "Empty setup script, no need to trigger a jupyter build."
                )
                return
    else:
        app.logger.info("No setup script, no need to trigger a jupyter build.")
        return

    if utils.get_active_custom_jupyter_images():
        app.logger.info(
            "There are active custom jupyter images, no need to trigger a build."
        )
        return

    if db.session.query(
        db.session.query(JupyterImageBuild)
        .filter(JupyterImageBuild.status.in_(["PENDING", "STARTED"]))
        .exists()
    ).scalar():
        app.logger.info(
            "Ongoing custom jupyter image build, no need to trigger a build."
        )
        return

    # Note: this is not race condition free in case of concurrent APIs
    # restarting.
    try:
        app.logger.info("Triggering custom jupyter build.")
        with TwoPhaseExecutor(db.session) as tpe:
            CreateJupyterEnvironmentBuild(tpe).transaction()
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


def cleanup():
    app = create_app(
        config_class=CONFIG_CLASS, use_db=True, be_scheduler=False, register_api=False
    )

    with app.app_context():
        app.logger.info("Starting app cleanup.")

        try:
            app.logger.info("Aborting interactive pipeline runs.")
            runs = InteractivePipelineRun.query.filter(
                InteractivePipelineRun.status.in_(["PENDING", "STARTED"])
            ).all()
            with TwoPhaseExecutor(db.session) as tpe:
                for run in runs:
                    AbortPipelineRun(tpe).transaction(run.uuid)

            app.logger.info("Shutting down interactive sessions.")
            int_sessions = InteractiveSession.query.all()
            with TwoPhaseExecutor(db.session) as tpe:
                for session in int_sessions:
                    StopInteractiveSession(tpe).transaction(
                        session.project_uuid, session.pipeline_uuid, async_mode=False
                    )

            app.logger.info("Aborting environment builds.")
            builds = EnvironmentImageBuild.query.filter(
                EnvironmentImageBuild.status.in_(["PENDING", "STARTED"])
            ).all()
            with TwoPhaseExecutor(db.session) as tpe:
                for build in builds:
                    AbortEnvironmentImageBuild(tpe).transaction(
                        build.project_uuid,
                        build.environment_uuid,
                        build.image_tag,
                    )

            app.logger.info("Aborting jupyter builds.")
            builds = JupyterImageBuild.query.filter(
                JupyterImageBuild.status.in_(["PENDING", "STARTED"])
            ).all()
            with TwoPhaseExecutor(db.session) as tpe:
                for build in builds:
                    AbortJupyterEnvironmentBuild(tpe).transaction(build.uuid)

            app.logger.info("Aborting running one off jobs.")
            jobs = Job.query.filter_by(schedule=None, status="STARTED").all()
            with TwoPhaseExecutor(db.session) as tpe:
                for job in jobs:
                    AbortJob(tpe).transaction(job.uuid)

            app.logger.info("Aborting running pipeline runs of cron jobs.")
            runs = NonInteractivePipelineRun.query.filter(
                NonInteractivePipelineRun.status.in_(["STARTED"])
            ).all()
            with TwoPhaseExecutor(db.session) as tpe:
                for run in runs:
                    AbortPipelineRun(tpe).transaction(run.uuid)

            # Delete old JupyterEnvironmentBuilds on to avoid
            # accumulation in the DB. Leave the latest such that the
            # user can see details about the last executed build after
            # restarting Orchest.
            jupyter_image_builds = (
                JupyterImageBuild.query.order_by(
                    JupyterImageBuild.requested_time.desc()
                )
                .offset(1)
                .all()
            )
            # Can't use offset and .delete in conjunction in sqlalchemy
            # unfortunately.
            for jupyter_image_build in jupyter_image_builds:
                db.session.delete(jupyter_image_build)

            db.session.commit()

        except Exception as e:
            app.logger.error("Cleanup failed.")
            app.logger.error(e)
