#! /usr/bin/env sh

umask 002

# Start Gunicorn
gunicorn -k eventlet -c "$GUNICORN_CONF" "$APP_MODULE"