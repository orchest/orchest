#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Check whether `docker` command requires sudo
if ! docker ps >/dev/null 2>/dev/null ; then
    DOCKER_SUDO=sudo
fi

# Check whether on system with apt-get, if so, offer to install update-service
if command -v apt-get &> /dev/null
then
    # check if update-service is installed
    NGINX_UPDATE_SERVICE_LOCATION=/etc/nginx/sites-available/update-service
    if ! test -f "$NGINX_UPDATE_SERVICE_LOCATION"; then

        # prompt user whether they want to install it
        read -p "Do you want to install the update service (it runs as a nginx service) [N/y] " -r
        if [[ $REPLY =~ ^[Yy]$ ]]
        then
            $DIR/scripts/install_update_service.sh
        fi
        
    else
        # make sure update service is running
        sudo systemctl start nginx
    fi
fi

HOST_CONFIG_DIR=$HOME/.config/orchest
HOST_USER_DIR=$DIR/userdir

# create config dir if it doesn't exist
mkdir -p "${HOST_CONFIG_DIR}"

$DOCKER_SUDO docker run --name orchest-ctl --rm \
    -v /var/run/docker.sock:/var/run/docker.sock -e HOST_CONFIG_DIR="${HOST_CONFIG_DIR}" \
    -e HOST_PWD="${DIR}" -e HOST_USER_DIR="${HOST_USER_DIR}" orchestsoftware/orchest-ctl "$@"
