#!/usr/bin/env bash

# This needs to be run as `root` user as we're going to listen on port 80
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root" 
   exit 1
fi

## Utility functions
function check_file {
    if [ -f "${1}" ]; then
        echo "File found at ${1}"
    else
        echo "No file at ${1}"
    fi
}
## End of utility functions

if [ -z "$1" ]; then
    echo "Please provide a domain name as the first argument."
    exit 1
fi
if [ -z "$2" ]; then
    echo "Please provide an email address as the second argument."
    exit 1
fi

export DOCKER_BUILDKIT=1
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
SITE_DOMAIN=$1
EMAIL=$2

echo "Using SITE_DOMAIN=${SITE_DOMAIN} and EMAIL=${EMAIL}."

# shutdown orchest to make sure port 80 is available (port 80 is used in dev mode)
$DIR/../orchest.sh stop

apt-get install python3-pip -y

# run a virtualenv
pip3 install virtualenv

mkdir /tmp/letsencrypt
cd /tmp/letsencrypt

virtualenv venv
source venv/bin/activate

pip install certbot
certbot certonly --noninteractive --standalone --agree-tos -m $EMAIL -d $SITE_DOMAIN

# LE generated certificates should now live in
CHAIN_PATH=/etc/letsencrypt/live/$SITE_DOMAIN/fullchain.pem
KEY_PATH=/etc/letsencrypt/live/$SITE_DOMAIN/privkey.pem

check_file $CHAIN_PATH
check_file $KEY_PATH

# copy certificates to nginx-proxy certs folders
cp $CHAIN_PATH $DIR/../orchest/nginx-proxy/certs/server.crt
cp $KEY_PATH $DIR/../orchest/nginx-proxy/certs/server.key

# build nginx container with letsencrypt certs
docker build \
    -t orchestsoftware/nginx-proxy \
    --build-arg enable_ssl=true \
    --build-arg domain=$SITE_DOMAIN \
    -f $DIR/../orchest/nginx-proxy/Dockerfile \
    $DIR/../

# clean up tmp
rm -r /tmp/letsencrypt