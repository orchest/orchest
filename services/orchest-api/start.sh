#! /usr/bin/env sh

set -e

# Start Gunicorn
umask 002

# Release phase
python migration_manager.py db upgrade

if [ "$FLASK_ENV" = "development" ]; then
    flask run --host=0.0.0.0 --port=80
else
    exec gunicorn -k eventlet -c "$GUNICORN_CONF" "$APP_MODULE"
fi
