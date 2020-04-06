# TODO: there should be an option like this for the /app/core/start_server.py
#       otherwise it cannot start the JupyterLab instance correctly
NOTEBOOK_DIR = '/notebooks'
NOTEBOOK_DIR = '/home/yannick/Documents/experiments'


class Config:
    DEBUG = False
    TESTING = False


class ProductionConfig(Config):
    # Production is done using uwsgi and thus requires different
    # configuration keys than Flask.
    HOST = 'localhost'
    PORT = 80


class DevelopmentConfig(Config):
    DEBUG = True
    SERVER_NAME = 'localhost:5000'


class TestingConfig(Config):
    TESTING = True
