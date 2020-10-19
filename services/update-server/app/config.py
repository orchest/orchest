import os
import pathlib


class Config:
    DEBUG = False


class DevelopmentConfig(Config):
    DEBUG = True


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
# CONFIG_CLASS = DevelopmentConfig
