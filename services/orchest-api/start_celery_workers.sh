#!/bin/bash

# Experiments.
celery worker -A app.core.tasks \
    -l INFO \
    -Q experiments \
    -n worker-expriments \
    --statedb /userdir/.orchest/celery-state.db \
    --concurrency=1 \
    --detach

# Interactive runs. "celery" is the default queue name.
celery worker -A app.core.tasks -l INFO -Q celery -n worker-interactive --concurrency=1
