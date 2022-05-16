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
    USERDIR_PVC = os.environ.get("USERDIR_PVC", "userdir-pvc")
    WEBSERVER_LOGS = _config.WEBSERVER_LOGS
    STATIC_DIR = os.path.join(dir_path, "..", "..", "client", "dist")

    DEFAULT_ENVIRONMENTS = _config.DEFAULT_ENVIRONMENTS
    ORCHEST_API_ADDRESS = _config.ORCHEST_API_ADDRESS

    POSTHOG_API_KEY = "c3l6aU4waEhweEhBQnQ0UHRyT0FxRm1iX25wLXYwanRDNElIanZCZ1pwMA=="
    POSTHOG_HOST = "https://analytics.orchest.io"

    POLL_ORCHEST_EXAMPLES_JSON = True
    ORCHEST_EXAMPLES_JSON_PATH = "/userdir/.orchest/orchest_examples_data.json"
    ORCHEST_EXAMPLES_JSON_POLL_INTERVAL = 60

    POLL_ORCHEST_UPDATE_INFO_JSON = True
    ORCHEST_UPDATE_INFO_JSON_PATH = "/userdir/.orchest/orchest_update_info.json"
    ORCHEST_UPDATE_INFO_JSON_POLL_INTERVAL = 60

    # TODO: point readthedocs to stable instead of latest once stable
    #  is up
    ORCHEST_WEB_URLS = {
        "readthedocs": "https://docs.orchest.io/en/stable",
        "slack": (
            "https://join.slack.com/t/orchest/shared_invite/"
            "zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w"
        ),
        "github": "https://github.com/orchest/orchest",
        "website": "https://www.orchest.io",
        "orchest_examples_repo": "https://github.com/orchest/orchest-examples",
        "orchest_examples_json": (
            "https://raw.githubusercontent.com/orchest/orchest-examples/main/"
            "orchest_examples_data.json"
        ),
        "orchest_update_info_json": (
            _config.ORCHEST_UPDATE_INFO_URL.format(version=os.getenv("ORCHEST_VERSION"))
        ),
    }

    ENVIRONMENT_DEFAULTS = {
        "name": "Python 3",
        "language": "python",
        "gpu_support": False,
        "base_image": DEFAULT_ENVIRONMENTS[0]["base_image"],
        "setup_script": _config.DEFAULT_SETUP_SCRIPT,
    }

    # Content for `.orchest/.gitignore` in project dir.
    # `pipelines/*/logs/` excludes `logs/` directories that are two
    # levels below the `.pipelines/` directory.
    GIT_IGNORE_PROJECT_HIDDEN_ORCHEST = [
        "pipelines/*/logs/",
        "pipelines/*/data/",
        "plasma.sock",
    ]
    # On project creation through Orchest, we want the patterns from the
    # `.orchest/.gitignore` to be present in the root-level `.gitignore`
    # so that when creating a new job the files are not copied to the
    # snapshot.
    GIT_IGNORE_PROJECT_ROOT = [
        *[".orchest/" + pattern for pattern in GIT_IGNORE_PROJECT_HIDDEN_ORCHEST],
        ".ipynb_checkpoints/",
    ]

    FLASK_ENV = os.environ.get("FLASK_ENV", "production")

    TELEMETRY_DISABLED = False
    TELEMETRY_INTERVAL = 15  # in minutes

    CLOUD = _config.CLOUD

    GPU_ENABLED_INSTANCE = _config.GPU_ENABLED_INSTANCE
    INTERCOM_APP_ID = "v61sr629"
    INTERCOM_DEFAULT_SIGNUP_DATE = "1577833200"

    CLOUD_UNMODIFIABLE_CONFIG_VALUES = [
        "TELEMETRY_UUID",
        "TELEMETRY_DISABLED",
        "AUTH_ENABLED",
        "INTERCOM_USER_EMAIL",
    ]

    RESOURCE_DIR = os.path.join(dir_path, "res")

    LOGGING_CONFIG = {
        "version": 1,
        "formatters": {
            "verbose": {
                "format": (
                    "%(levelname)s:%(name)s:%(filename)s - [%(asctime)s] - %(message)s"
                ),
                "datefmt": "%d/%b/%Y %H:%M:%S",
            },
            "minimal": {
                "format": ("%(levelname)s:%(name)s:%(filename)s - %(message)s"),
                "datefmt": "%d/%b/%Y %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
                "class": "logging.StreamHandler",
                "formatter": "verbose",
            },
            "console-minimal": {
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
                "class": "logging.StreamHandler",
                "formatter": "minimal",
            },
            "webserver-file-log": {
                "level": "INFO",
                "formatter": "verbose",
                "class": "logging.FileHandler",
                "filename": _config.WEBSERVER_LOGS,
                "mode": "a",
            },
        },
        "root": {
            "handlers": ["console"],
            "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
        },
        "loggers": {
            # NOTE: this is the name of the Flask app, since we use
            # ``__name__``. Using ``__name__`` is required for the app
            # to function correctly. See:
            # https://blog.miguelgrinberg.com/post/why-do-we-pass-name-to-the-flask-class
            __name__: {
                "handlers": ["console"],
                "propagate": False,
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
            "engineio": {
                "handlers": ["console"],
                "level": "ERROR",
            },
            "alembic": {
                "handlers": ["console"],
                "level": "WARNING",
            },
            "werkzeug": {
                # NOTE: Werkzeug automatically creates a handler at the
                # level of its logger if none is defined.
                "level": "INFO",
                "handlers": ["console-minimal"],
            },
            "gunicorn": {
                "handlers": ["webserver-file-log"],
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
                "propagate": False,
            },
            "job-scheduler": {
                "handlers": ["console"],
                "propagate": False,
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
            "orchest-lib": {
                "handlers": ["console"],
                "propagate": False,
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
        },
    }


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    # This config is used by the tests.
    TESTING = True
    TELEMETRY_DISABLED = True
    POLL_ORCHEST_EXAMPLES_JSON = False
    POLL_ORCHEST_UPDATE_INFO_JSON = False

    # No file logging.
    LOGGING_CONFIG = {
        "version": 1,
        "formatters": {
            "verbose": {
                "format": (
                    "%(levelname)s:%(name)s:%(filename)s - [%(asctime)s] - %(message)s"
                ),
                "datefmt": "%d/%b/%Y %H:%M:%S",
            },
            "minimal": {
                "format": ("%(levelname)s:%(name)s:%(filename)s - %(message)s"),
                "datefmt": "%d/%b/%Y %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
                "class": "logging.StreamHandler",
                "formatter": "verbose",
            },
            "console-minimal": {
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
                "class": "logging.StreamHandler",
                "formatter": "minimal",
            },
        },
        "root": {
            "handlers": ["console"],
            "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
        },
        "loggers": {
            # NOTE: this is the name of the Flask app, since we use
            # ``__name__``. Using ``__name__`` is required for the app
            # to function correctly. See:
            # https://blog.miguelgrinberg.com/post/why-do-we-pass-name-to-the-flask-class
            __name__: {
                "handlers": ["console"],
                "propagate": False,
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
            "engineio": {
                "handlers": ["console"],
                "level": "ERROR",
            },
            "alembic": {
                "handlers": ["console"],
                "level": "WARNING",
            },
            "werkzeug": {
                # NOTE: Werkzeug automatically creates a handler at the
                # level of its logger if none is defined.
                "level": "INFO",
                "handlers": ["console-minimal"],
            },
            "gunicorn": {
                "handlers": ["console"],
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
                "propagate": False,
            },
            "orchest-lib": {
                "handlers": ["console"],
                "propagate": False,
                "level": os.getenv("ORCHEST_LOG_LEVEL", "INFO"),
            },
        },
    }


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
if os.environ.get("FLASK_ENV") == "development":
    CONFIG_CLASS = DevelopmentConfig
