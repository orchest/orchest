class Config:
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = 'sqlite:////userdir/.orchest/auth-server.db'

    TOKEN_DURATION_HOURS = 24

    STATIC_DIR = "/orchest/orchest/auth-server/app/app/static"

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
class DevelopmentConfig(Config):
    DEBUG = True

# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config

# Development
# CONFIG_CLASS = DevelopmentConfig
