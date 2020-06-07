class Config:
    DEBUG = False
    TESTING = False

    # must be uppercase
    # https://flask-appbuilder.readthedocs.io/en/latest/multipledbs.html
    SQLALCHEMY_DATABASE_URI = 'sqlite:///resources.db'
    SQLALCHEMY_BINDS = {
        'runs_db': SQLALCHEMY_DATABASE_URI,
        # /userdir works because it's mounted via docker
        'scheduled_runs_db': 'sqlite:////userdir/persistent.db',
    }
    #Valid SQLite URL forms are: 
    # sqlite:///:memory: (or, sqlite://), 
    # sqlite:///relative/path/to/file.db, 
    # sqlite:////absolute/path/to/file.db –

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # TODO: for now this is put here.
    ORCHEST_API_ADDRESS = 'http://orchest-api:80/api'

    # ---- Celery configurations ----
    # NOTE: the configurations have to be lowercase.
    # NOTE: Flask will not configure lowercase variables. Therefore the
    # config class will be loaded directly by the Celery instance.
    broker_url = 'amqp://guest:guest@rabbitmq-server:5672//'
    imports = ('app.core.runners',)

    # result_persistent = True
    #   This is message result persistency, not queue persistency
    #   https://docs.celeryproject.org/en/stable/userguide/configuration.html#rpc-backend-settings

    # result_backend = 'rpc://'
    #   use with our scheduled_runs.db?
    #   https://docs.celeryproject.org/en/stable/userguide/configuration.html#task-result-backend-settings

    # task_track_started = True
    #   tracks 'STARTED' state, 
    #   otherwise, all tasks are either pending, finished, or waiting to be retried
    #   https://docs.celeryproject.org/en/stable/userguide/configuration.html#task-track-started

    # task_publish_retry
    #   True by default
    #   https://docs.celeryproject.org/en/stable/userguide/configuration.html#task-publish-retry

    # task_acks_late
    #   a configuration to keep an eye on. Could be useful
    #   https://docs.celeryproject.org/en/stable/userguide/configuration.html#task-acks-late
    #   https://stackoverflow.com/questions/54415515/celery-active-tasks-persistence


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
