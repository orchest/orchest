#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# for nginx-proxy SSL build

# Read flags.
while getopts "d:e:m:" opt; do
  case $opt in
    domain)
      DOMAIN=$OPTARG
      ;;
    email)
      EMAIL=$OPTARG
      ;;
    m)
      MODE=$OPTARG
      echo "Will restart Orchest in dev mode"
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

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
$ORCHEST_REPO_ROOT/orchest.sh start $MODE

