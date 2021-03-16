from _orchest.internals import config as _config


class Config:
    DEBUG = False
    CLOUD = _config.CLOUD


class DevelopmentConfig(Config):
    DEBUG = True


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
# CONFIG_CLASS = DevelopmentConfig
