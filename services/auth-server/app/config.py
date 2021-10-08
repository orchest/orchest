import os

from _orchest.internals import config as _config


class Config:
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres@orchest-database/auth_server"

    TOKEN_DURATION_HOURS = 24

    dir_path = os.path.dirname(os.path.realpath(__file__))

    CLOUD = os.environ.get("CLOUD") == "true"
    ORCHEST_API_ADDRESS = _config.ORCHEST_API_ADDRESS
    CLOUD_URL = "https://cloud.orchest.io"
    GITHUB_URL = "https://github.com/orchest/orchest"
    DOCUMENTATION_URL = "https://www.orchest.io/docs"
    VIDEOS_URL = "https://www.orchest.io/video-tutorials"

    STATIC_DIR = os.path.join(dir_path, "..", "client", "dist")

    SQLALCHEMY_TRACK_MODIFICATIONS = False


class DevelopmentConfig(Config):
    DEBUG = True


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
if os.environ.get("FLASK_ENV") == "development":
    CONFIG_CLASS = DevelopmentConfig
