class Config:
    DEBUG = False
    TESTING = False

    SQLALCHEMY_DATABASE_URI = 'sqlite:///resources.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # TODO: for now this is put here.
    ORCHEST_API_ADDRESS = 'http://orchest-api:80/api'

    # ---- Celery configurations ----
    # NOTE: the configurations have to be lowercase.
    # NOTE: Flask will not configure lowercase variables. Therefore the
    # config class will be loaded directly by the Celery instance.
    broker_url = 'amqp://guest:guest@rabbitmq-server:5672//'
    imports = ('app.core.tasks',)
    # result_backend = 'rpc://'
    # task_track_started = True


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
