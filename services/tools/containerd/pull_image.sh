#!/bin/sh
set -e

ctr -n=k8s.io -a=/var/run/runtime.sock i pull "${IMAGE_TO_PULL}" --skip-verify
