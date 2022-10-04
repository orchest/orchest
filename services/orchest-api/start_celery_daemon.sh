#!/bin/bash

set -e
BP=$(curl http://orchest-api/api/ctl/orchest-settings -s | jq -r .MAX_BUILDS_PARALLELISM)
IP=$(curl http://orchest-api/api/ctl/orchest-settings -s | jq -r .MAX_INTERACTIVE_RUNS_PARALLELISM)
JP=$(curl http://orchest-api/api/ctl/orchest-settings -s | jq -r .MAX_JOB_RUNS_PARALLELISM)

if [ -z "${BP}" ]; then
	exit 11;
fi

if [ -z "${IP}" ]; then

	exit 11;
fi

if [ -z "${JP}" ]; then
	exit 11;
fi


MAX_BUILDS_PARALLELISM="${BP}" \
MAX_INTERACTIVE_RUNS_PARALLELISM="${IP}" \
MAX_JOB_RUNS_PARALLELISM="${JP}" \
/usr/bin/supervisord -n -m 002 -u 0