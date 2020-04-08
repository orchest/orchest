class Config:
    DEBUG = False
    TESTING = False


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


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
CONFIG_CLASS = DevelopmentConfig
