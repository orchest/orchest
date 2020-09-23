import os
import pathlib

class Config:
    DEBUG = False

    # deduce ORCHEST_ROOT from file path
    file_components = str(pathlib.Path(__file__).parent.absolute())
    ORCHEST_ROOT = os.path.join(os.path.join(file_components), "../../../")

    
class DevelopmentConfig(Config):
    DEBUG = True

# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
# CONFIG_CLASS = DevelopmentConfig
