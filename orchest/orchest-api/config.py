class Config:
    DEBUG = False
    TESTING = False

    SQLALCHEMY_DATABASE_URI = 'sqlite:///resources.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Celery configurations. Note that they have to be lowercase.
    broker_url = None
    imports = ['app.core.runners', ]

    # TODO: for now this is put here.
    ORCHEST_API_ADDRESS = '127.0.0.1:5000/api'


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    # This config is used by the tests.
    TESTING = True


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
CONFIG_CLASS = DevelopmentConfig
