#!/bin/bash

umask 002

# Experiments.
celery worker -A app.core.tasks \
    -l INFO \
    -Q experiments \
    -n worker-expriments \
    --statedb /userdir/.orchest/celery-state.db \
    -f celery_experiments.log \
    --concurrency=1 \
    --pidfile="worker-expriments.pid" \
    --detach

# Interactive runs. "celery" is the default queue name.
celery worker -A app.core.tasks \
    -l INFO \
    -Q celery \
    -n worker-interactive \
    -f celery_interactive.log \
    --pidfile="worker-interactive.pid" \
    --detach

# Environment builds. "celery" is the default queue name.
# max-tasks-per-child is currently needed, because SocketIO is not
# cleaning up state when using disconnect, which will lead to sockets
# related failures in a subsequent task
celery worker -A app.core.tasks \
    -l INFO \
    -Q environment_builds \
    -n worker-env-builds \
    --statedb /userdir/.orchest/celery-environment-builds-state.db \
    -f celery_env_builds.log \
    --concurrency=1 \
    --pidfile="worker-env-builds.pid" \
    --max-tasks-per-child 1
