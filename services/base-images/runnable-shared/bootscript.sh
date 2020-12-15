# This shell script is used to start either

# 1) the kernel for Jupyter or
# 2) the run.py to execute the container as a pipeline step.

# Update the UID of the default user
if [ "$ORCHEST_HOST_UID" != "0" ]; then
    EXISTING_USER=$(id -nu $ORCHEST_HOST_UID)
    if [ $? -eq 0 ]; then
        if ! [ "$EXISTING_USER" = "orchest" ]; then
            sudo userdel "$EXISTING_USER"
        fi
    fi
    
    sudo usermod -u $ORCHEST_HOST_UID orchest
fi

sudo chown orchest:orchest -R /home/orchest

if [ "$1" = "runnable" ]; then 
    python run.py "$2" "$3"
elif [ "$1" = "idle" ]; then 
    # infinite sleep to run user installation
    while true; do sleep 86400; done
else
    /usr/local/bin/bootstrap-kernel.sh
fi