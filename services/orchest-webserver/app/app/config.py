import os

from _orchest.internals import config as _config


class Config:
    DEBUG = False
    TESTING = False

    SQLALCHEMY_DATABASE_URI = "postgresql://postgres@orchest-database/orchest_webserver"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    dir_path = os.path.dirname(os.path.realpath(__file__))

    USER_DIR = os.path.join("/userdir")
    PROJECTS_DIR = os.path.join(USER_DIR, "projects")
    HOST_USER_DIR = os.environ.get("HOST_USER_DIR")
    WEBSERVER_LOGS = _config.WEBSERVER_LOGS
    STATIC_DIR = os.path.join(dir_path, "..", "static")

    DEFAULT_ENVIRONMENTS = _config.DEFAULT_ENVIRONMENTS
    ORCHEST_API_ADDRESS = _config.ORCHEST_API_ADDRESS

    POSTHOG_API_KEY = "c3l6aU4waEhweEhBQnQ0UHRyT0FxRm1iX25wLXYwanRDNElIanZCZ1pwMA=="
    POSTHOG_HOST = "https://analytics.orchestapp.com"

    # TODO: point readthedocs to stable instead of latest once stable
    #  is up
    ORCHEST_WEB_URLS = {
        "readthedocs": "https://orchest.readthedocs.io/en/stable",
        "slack": (
            "https://join.slack.com/t/orchest/shared_invite/"
            "zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w"
        ),
        "github": "https://github.com/orchest/orchest",
        "website": "https://www.orchest.io",
    }

    ENVIRONMENT_DEFAULTS = {
        "name": "Python 3",
        "language": "python",
        "gpu_support": False,
        "base_image": DEFAULT_ENVIRONMENTS[0]["base_image"],
        "setup_script": _config.DEFAULT_SETUP_SCRIPT,
    }

    PROJECT_ORCHEST_GIT_IGNORE_CONTENT = "\n".join(["logs/", "data/"])

    FLASK_ENV = os.environ.get("FLASK_ENV", "production")

    DEBUG = True

    TELEMETRY_DISABLED = False
    TELEMETRY_INTERVAL = 15  # in minutes

    CLOUD = _config.CLOUD
    _CLOUD_UNMODIFIABLE_CONFIG_VALUES = [
        "TELEMETRY_UUID",
        "TELEMETRY_DISABLED",
        "AUTH_ENABLED",
    ]

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
