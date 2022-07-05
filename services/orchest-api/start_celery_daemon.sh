#!/bin/bash

set -e
JP=$(curl http://orchest-api/api/ctl/orchest-settings -s | jq -r .MAX_JOB_RUNS_PARALLELISM)
IP=$(curl http://orchest-api/api/ctl/orchest-settings -s | jq -r .MAX_INTERACTIVE_RUNS_PARALLELISM)

if [ -z "${JP}" ]; then
	exit 11;
fi

if [ -z "${IP}" ]; then
	exit 11;
fi

MAX_JOB_RUNS_PARALLELISM="${JP}" \
MAX_INTERACTIVE_RUNS_PARALLELISM="${IP}" \
/usr/bin/supervisord -n -m 002 -u 0