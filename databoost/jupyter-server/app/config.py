# Set to False when building docker image
DEBUG = False

# Fix issue where deployment with uwsgi is different from running via
# `python`. Thus set DEBUG to False when deploying for production or
# when running inside docker container with uwsgi.
HOST = 'localhost'
PORT = 80
if DEBUG:
    SERVER_NAME = f'{HOST}:{PORT}'
