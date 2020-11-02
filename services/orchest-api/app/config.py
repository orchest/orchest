class Config:
    DEBUG = False
    TESTING = False

    # must be uppercase
    # https://flask-appbuilder.readthedocs.io/en/latest/multipledbs.html
    SQLALCHEMY_DATABASE_URI = "sqlite:////tmp/resources.db"
    SQLALCHEMY_BINDS = {
        # /userdir works because it's mounted via docker
        "persistent_db": "sqlite:////userdir/.orchest/orchest-api.db",
    }

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # TODO: for now this is put here.
    ORCHEST_API_ADDRESS = "http://orchest-api:80/api"

    # ---- Celery configurations ----
    # NOTE: the configurations have to be lowercase.
    # NOTE: Flask will not configure lowercase variables. Therefore the
    # config class will be loaded directly by the Celery instance.
    broker_url = "amqp://guest:guest@rabbitmq-server:5672//"

    # note: the database might require trimming from time to time,
    # to enable having the db trimmed automatically use:
    # https://docs.celeryproject.org/en/master/userguide/configuration.html#std:setting-result_expires
    # note that "When using the database backend, celery beat must be running for the results to be expired."
    # The db reaching a large size is probably an unreasonable edge case, given that currently our celery tasks do
    # not produce output.
    # For this reason no solution is provided for this, taking into account that we will eventually
    # implement cronjobs and such trimming might be an internal cronjob, or automatically managed
    # by celery if we end using "celery beat".
    result_backend = "db+sqlite:////userdir/.orchest/celery_result_backend.db"

    imports = ("app.core.tasks",)
    task_create_missing_queues = True
    task_default_queue = "celery"
    task_routes = {
        "app.core.tasks.start_non_interactive_pipeline_run": {"queue": "experiments"},
        "app.core.tasks.run_partial": {"queue": "celery"},
    }


class DevelopmentConfig(Config):
    DEBUG = True
    # ORCHEST_API_ADDRESS = 'http://127.0.0.1:5000/api'


class TestingConfig(Config):
    # This config is used by the tests.
    TESTING = True


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
# CONFIG_CLASS = DevelopmentConfig
