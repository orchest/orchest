#! /usr/bin/env sh

. /user_permission_setup.sh

# Start Gunicorn
sudo --preserve-env -H -u $NON_ROOT_USER -- gunicorn -k eventlet -c "$GUNICORN_CONF" "$APP_MODULE"