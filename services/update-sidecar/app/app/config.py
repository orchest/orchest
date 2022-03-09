import os


class Config:
    # This is to make it so that Orchest can be completely stopped,
    # including the auth-server and orchest-database, while still
    # having some security. This is because if the auth-server is down,
    # the client needs to be able to get the logs without login.
    TOKEN = os.environ["TOKEN"]
    UPDATE_STARTED_FILE = "/tmp/update-started"
    UPDATE_COMPLETE_FILE = "/tmp/update-complete"
    UPDATE_FILE_LOG = "/tmp/update-log"
    UPDATE_POD_NAME = os.environ["UPDATE_POD_NAME"]


class DevelopmentConfig(Config):
    DEBUG = True


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
if os.environ.get("FLASK_ENV") == "development":
    CONFIG_CLASS = DevelopmentConfig
