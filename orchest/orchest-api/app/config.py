class Config:
    DEBUG = False
    TESTING = False

    SQLALCHEMY_DATABASE_URI = 'sqlite:///resources.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # TODO: for now this is put here.
    ORCHEST_API_ADDRESS = 'http://orchest-api:80/api'

    # Celery configurations. Note that they have to be lowercase.
    # NOTE: Flask will not configuration variables that are lowercase.
    # Thus the configuration class is also loaded directly by the Celery
    # instance.
    # broker_url = 'amqp://guest:guest@172.17.0.2:5672//'
    broker_url = 'amqp://guest:guest@rabbitmq-server:5672//'
    imports = ('app.core.runners',)
    # result_backend = 'rpc://'
    # task_track_started = True


class DevelopmentConfig(Config):
    DEBUG = True

    # TODO: for now this is put here.
    # ORCHEST_API_ADDRESS = 'http://127.0.0.1:5000/api'


class TestingConfig(Config):
    # This config is used by the tests.
    TESTING = True


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
# CONFIG_CLASS = DevelopmentConfig
