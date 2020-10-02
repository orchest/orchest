#!/bin/bash



DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Check whether `docker` command requires sudo
if ! docker ps >/dev/null 2>/dev/null ; then
    USERNAME=$(whoami)

    ORCHEST_PATH=.
    # Check if orchest is in PWD
    if ! test -f "orchest.sh"; then
        ORCHEST_PATH=$DIR
    fi

    echo "docker command not accesible for user '$USERNAME'. Please run \`sudo -u $(whoami) $ORCHEST_PATH/orchest.sh\` instead."
    exit 1
fi

# Warnings

if [ $1 == "update" ] ; then
    read -p "Updating Orchest will stop all Orchest related containers. Are you sure? [N/y] " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]
    then
        echo "Cancelled. Exiting ..."
        exit
    else
        # Update orchest-ctl to latest before performing update
        docker pull orchestsoftware/orchest-ctl:latest
    fi
fi

# End of warnings


HOST_CONFIG_DIR=$HOME/.config/orchest
HOST_USER_DIR=$DIR/userdir

# create config dir if it doesn't exist
mkdir -p "${HOST_CONFIG_DIR}"

docker run --name orchest-ctl --rm \
    -v /var/run/docker.sock:/var/run/docker.sock -v "${DIR}":/orchest-host -e HOST_CONFIG_DIR="${HOST_CONFIG_DIR}" \
    -e HOST_REPO_DIR="${DIR}" -e HOST_USER_DIR="${HOST_USER_DIR}" orchestsoftware/orchest-ctl:latest "$@"
