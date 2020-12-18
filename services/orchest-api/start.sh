#! /usr/bin/env sh

# Start Gunicorn
umask 002
exec gunicorn -k eventlet -c "$GUNICORN_CONF" "$APP_MODULE"