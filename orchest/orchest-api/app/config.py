class Config:
    DEBUG = False
    TESTING = False

    # must be uppercase
    # https://flask-appbuilder.readthedocs.io/en/latest/multipledbs.html
    SQLALCHEMY_DATABASE_URI = 'sqlite:////tmp/resources.db'
    SQLALCHEMY_BINDS = {
        # /userdir works because it's mounted via docker
        'persistent_db': 'sqlite:////userdir/persistent.db',
    }

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # TODO: for now this is put here.
    ORCHEST_API_ADDRESS = 'http://orchest-api:80/api'

    # ---- Celery configurations ----
    # NOTE: the configurations have to be lowercase.
    # NOTE: Flask will not configure lowercase variables. Therefore the
    # config class will be loaded directly by the Celery instance.
    broker_url = 'amqp://guest:guest@rabbitmq-server:5672//'
    imports = ('app.core.tasks',)
    task_create_missing_queues = True
    task_default_queue = 'celery'
    task_routes = {
        'app.core.tasks.start_non_interactive_pipeline_run': {
            'queue': 'experiments'
        },
        'app.core.tasks.run_partial': {
            'queue': 'celery'
        },
    }
    # result_backend = 'rpc://'


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
