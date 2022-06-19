#!/bin/sh
set -e

docker -H unix:///var/run/runtime.sock pull "${IMAGE_TO_PULL}" 