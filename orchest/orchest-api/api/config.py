DEBUG = True

# Fix issue where deployment with uwsgi is different from running via
# `python`. Thus set DEBUG to False when deploying for production or
# when running inside docker container with uwsgi.
#HOST = ''
#PORT = 5000
#if DEBUG:
    #SERVER_NAME = f'{HOST}:{PORT}'

# Database configs.
SQLALCHEMY_DATABASE_URI = 'sqlite:///resources.db'
SQLALCHEMY_TRACK_MODIFICATIONS = False
