# This shell script is used to start either

# 1) the kernel for Jupyter or
# 2) the run.py to execute the container as a pipeline step.

# Update the UID of NB_USER
if [ "$ORCHEST_HOST_UID" != "1000" ]; then
    sudo usermod -u $ORCHEST_HOST_UID $NB_USER
fi

NB_UID=$ORCHEST_HOST_UID
sudo chown $ORCHEST_HOST_UID -R /home/$NB_USER

if [ "$1" = "runnable" ]; then 
    sudo --preserve-env -H -- python run.py "$2" "$3"
else
    sudo --preserve-env -H -- /usr/local/bin/bootstrap-kernel.sh
fi