class Config:
    DEBUG = False
    TESTING = False

    SQLALCHEMY_DATABASE_URI = 'sqlite:///resources.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Celery configurations. Note that they have to be lowercase.
    broker_url = None
    imports = ['app.core.runners', ]


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    # This config is used by the tests.
    TESTING = True


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
# CONFIG_CLASS = DevelopmentConfig

