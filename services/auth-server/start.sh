#! /usr/bin/env sh

set -e

# Start Gunicorn
umask 002

# Release phase
python migration_manager.py db upgrade

if [ "$FLASK_ENV" = "development" ]; then
    python main.py
else
    exec gunicorn -k eventlet -c "$GUNICORN_CONF" "$APP_MODULE"
fi
