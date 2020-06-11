import os
import logging

class Config:
    DEBUG = False
    TESTING = False

    SQLALCHEMY_DATABASE_URI = "sqlite:///../app/data/development.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    dir_path = os.path.dirname(os.path.realpath(__file__))

    USER_DIR = os.path.join("/userdir")
    HOST_USER_DIR = os.environ.get("HOST_USER_DIR")
    LOG_DIR = ".logs"
    WEBSERVER_LOG_DIR = "/app/orchest-webserver.log"
    STATIC_DIR = os.path.join(dir_path, "..", "static")

    ORCHEST_API_ADDRESS = "orchest-api"

    DEBUG = True

    TELEMETRY_INTERVAL = 15 # in minutes

    if DEBUG:
        logging.basicConfig(level=logging.INFO)

    RESOURCE_DIR = os.path.join(dir_path, "res")


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    # This config is used by the tests.
    TESTING = True


# ---- CONFIGURATIONS ----
# Production
# CONFIG_CLASS = Config

# Development
CONFIG_CLASS = DevelopmentConfig
