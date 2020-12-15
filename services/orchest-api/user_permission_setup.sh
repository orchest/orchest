#! /usr/bin/env sh

### User permission setup

# check if UID exists in this container
id -nu $ORCHEST_HOST_UID 2>/dev/null
if ! [ $? -eq 0 ]; then
    # create user (and associated group)
    useradd -u $ORCHEST_HOST_UID u$ORCHEST_HOST_UID
    export NON_ROOT_USER=u$ORCHEST_HOST_UID
else
    export NON_ROOT_USER=$(id -nu $ORCHEST_HOST_UID)
fi

# Create home
mkdir -p /home/$NON_ROOT_USER

# determine Docker group GID
DOCKER_SOCK_GID=$(stat -c '%g' /var/run/docker.sock)

DOCKER_GROUP="docker"
# check if GID exists in this container
if ! [ $(getent group $DOCKER_SOCK_GID) ]; then
    groupadd -g $DOCKER_SOCK_GID docker
else
    DOCKER_GROUP="$(getent group $DOCKER_SOCK_GID | cut -d: -f1)"
fi

# To get Docker permissions add
usermod -a -G $DOCKER_GROUP $NON_ROOT_USER

# Make sure all files are owned by the new NON_ROOT_USER
chown -R $NON_ROOT_USER:$NON_ROOT_USER /orchest /home/$NON_ROOT_USER

### End of user permission setup