import os


class Config:
    DEBUG = False
    TESTING = False

    # TODO: use internal libary
    NOTEBOOK_DIR = "/pipeline-dir"


class ProductionConfig(Config):
    # Production is done using uwsgi and thus requires different
    # configuration keys than Flask.

    # Example configurations (note that these are the defaults).
    # HOST = 'localhost'
    # PORT = 80

    pass


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    # This config is used by the tests.
    TESTING = True

    abs_path = os.path.dirname(os.path.abspath(__file__))
    NOTEBOOK_DIR = os.path.join(abs_path, "app", "tmp")


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
# CONFIG_CLASS = DevelopmentConfig
