#!/usr/bin/env bash

if [ -z "$1" ]; then
    echo "Please provide a domain name as the first argument."
    exit 1
fi
DOMAIN=$1

# make sure use is prompted for sudo
sudo pwd

sudo apt update
sudo apt install python3-pip python3-dev build-essential libssl-dev libffi-dev python3-setuptools python3-venv nginx -y

python3 -m venv update_service_venv

source update_service_venv/bin/activate
python -m pip install wheel
python -m pip install -r app/requirements.txt

deactivate

./generate-conf.py $DOMAIN

# add nginx service
sudo mv update-service /etc/nginx/sites-available/update-service

# add system service
sudo mv update-service.service /etc/systemd/system/update-service.service

sudo rm /etc/nginx/sites-enabled/default >/dev/null 2>/dev/null
sudo ln -s /etc/nginx/sites-available/update-service /etc/nginx/sites-enabled  >/dev/null 2>/dev/null

sudo systemctl restart update-service
sudo systemctl status --no-pager update-service 

sudo systemctl restart nginx
sudo systemctl status --no-pager nginx