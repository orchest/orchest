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

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
SITE_DOMAIN=$1
EMAIL=$2

echo "Using SITE_DOMAIN=${SITE_DOMAIN} and EMAIL=${EMAIL}."

# shutdown orchest to make sure port 80 is available
echo "Shutting down Orchest ... (if it was running)"
$DIR/../orchest stop

apt-get install python3-pip -y
if [ $? != 0 ]; then
    # We probably held broken packages so we need to fix them and
    # try to install again.
    sudo apt -f install
    apt update -y && apt dist-upgrade -y
    apt-get install python3-pip -y
fi

# If you want it to be installed inside a virtualenv, then make sure
# to activate it beforehand.
pip3 install certbot
certbot certonly --noninteractive --standalone --agree-tos -m $EMAIL -d $SITE_DOMAIN

# LE generated certificates should now live in
CHAIN_PATH=/etc/letsencrypt/live/$SITE_DOMAIN/fullchain.pem
KEY_PATH=/etc/letsencrypt/live/$SITE_DOMAIN/privkey.pem

check_file $CHAIN_PATH
check_file $KEY_PATH

# copy certificates to nginx-proxy certs folders
cp $CHAIN_PATH $DIR/../services/nginx-proxy/certs/server.crt
cp $KEY_PATH $DIR/../services/nginx-proxy/certs/server.key

echo "When you start Orchest again (with orchest start) it should now expose SSL signed web service on port 443."
