import os
import subprocess

from _orchest.internals import config as _config


def get_dev_server_url():
    if os.environ.get("HOST_OS") == "darwin":
        # Use Docker for Desktop
        CLIENT_DEV_SERVER_URL = "http://host.docker.internal"
    else:
        # Find gateway IP (e.g. 172.18.0.1) to connect
        # to host.
        CLIENT_DEV_SERVER_URL = (
            "http://"
            + subprocess.check_output(
                ["bash", "-c", "/sbin/ip route|awk '/default/ { print $3 }'"]
            )
            .decode()
            .strip()
        )

    # Client auth-server debug server assumed to be running on 3001
    CLIENT_DEV_SERVER_URL += ":3001"

    return CLIENT_DEV_SERVER_URL


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
    CLIENT_DEV_SERVER_URL = get_dev_server_url()


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
if os.environ.get("FLASK_ENV") == "development":
    CONFIG_CLASS = DevelopmentConfig
