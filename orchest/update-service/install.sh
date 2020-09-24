#!/usr/bin/env bash

DOMAIN=$1

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $DIR

# Check whether default nginx site is enabled
NGINX_DEFAULT_SITE=/etc/nginx/sites-enabled/default
DELETE_DEFAULT=true
if test -f "$NGINX_DEFAULT_SITE"; then
    DELETE_DEFAULT=false
fi

# make sure use is prompted for sudo
sudo pwd>/dev/null

echo "[Installer] Installing Orchest update service"

echo "[Installer] apt-get update"
sudo apt-get update >/dev/null
sudo apt-get install python3-pip python3-dev build-essential libssl-dev libffi-dev python3-setuptools python3-venv nginx -y >/dev/null

echo "[Installer] venv creation"
python3 -m venv update_service_venv

source update_service_venv/bin/activate
echo "[Installer] pip install"
python -m pip install wheel >/dev/null
python -m pip install -r app/requirements.txt >/dev/null

deactivate

./generate-conf.py $DOMAIN

# add nginx site
sudo mv update-service /etc/nginx/sites-available/update-service

if [ $DELETE_DEFAULT == true ]; then 
    sudo rm $NGINX_DEFAULT_SITE >/dev/null 2>/dev/null
fi

sudo ln -s /etc/nginx/sites-available/update-service /etc/nginx/sites-enabled  >/dev/null 2>/dev/null

sudo systemctl restart nginx
echo "[Installer] nginx is: $(sudo systemctl is-active nginx)"

# add system service
sudo mv update-service.service /etc/systemd/system/update-service.service
sudo systemctl daemon-reload
sudo systemctl restart update-service
echo "[Installer] update-service is: $(sudo systemctl is-active update-service)"
echo "[Installer] Installation succesful."

