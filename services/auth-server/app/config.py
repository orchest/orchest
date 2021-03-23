import os


class Config:
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres@orchest-database/auth_server"

    TOKEN_DURATION_HOURS = 24

    CLOUD = os.environ.get("CLOUD") == "true"
    CLOUD_URL = "https://cloud.orchest.io"

    STATIC_DIR = "/orchest/services/auth-server/app/static"

    SQLALCHEMY_TRACK_MODIFICATIONS = False


class DevelopmentConfig(Config):
    DEBUG = True


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
# CONFIG_CLASS = DevelopmentConfig
