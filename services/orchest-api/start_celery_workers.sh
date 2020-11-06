#!/bin/bash

# Experiments.
celery worker -A app.core.tasks \
    -l INFO \
    -Q experiments \
    -n worker-expriments \
    --statedb /userdir/.orchest/celery-state-db \
    --concurrency=1 \
    --detach

# Interactive runs. "celery" is the default queue name.
celery worker -A app.core.tasks -l INFO -Q celery -n worker-interactive --concurrency=1 --detach

# Environment builds. "celery" is the default queue name.
# max-tasks-per-child is currently needed, because SocketIO is not cleaning up state when using disconnect,
# which will lead to sockets related failures in a subsequent task
celery worker -A app.core.tasks -l INFO -Q environment_builds -n worker-env-builds --concurrency=1 \
    --statedb /userdir/.orchest/celery-environment-builds-state.db --max-tasks-per-child 1
