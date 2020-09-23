#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# for nginx-proxy SSL build
DOMAIN=$1
EMAIL=$2

# .../orchest/orchest/update-service/app/scripts (up 4 levels)
ORCHEST_REPO_ROOT=$(readlink -m "$DIR/../../../../")

# shut down orchest
$ORCHEST_REPO_ROOT/orchest.sh stop

# first update orchest-ctl manually
docker pull orchestsoftware/orchest-ctl:latest

# update orchest
$ORCHEST_REPO_ROOT/orchest.sh update

# if domain nginx-proxy build
if [ ! -z "${DOMAIN}" ]; then
    $ORCHEST_REPO_ROOT/scripts/letsencrypt-nginx.sh $DOMAIN $EMAIL
fi

# start orchest
$ORCHEST_REPO_ROOT/orchest.sh start

