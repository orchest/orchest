#! /usr/bin/env sh

# check if UID exists in this container
id -nu $ORCHEST_HOST_UID 2>/dev/null
if ! [ $? -eq 0 ]; then
    # create user
    useradd -u $ORCHEST_HOST_UID u$ORCHEST_HOST_UID
    export NON_ROOT_USER=u$ORCHEST_HOST_UID
else
    export NON_ROOT_USER=$(id -nu $ORCHEST_HOST_UID)
fi

mkdir -p /home/$NON_ROOT_USER
chown -R $NON_ROOT_USER /home/$NON_ROOT_USER

sudo -u $NON_ROOT_USER jupyter lab "$@"