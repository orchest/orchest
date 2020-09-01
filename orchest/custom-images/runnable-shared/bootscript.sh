# This shell script is used to start either

# 1) the kernel for Jupyter or
# 2) the run.py to execute the container as a pipeline step.

if [ "$1" = "runnable" ]; then 
    python run.py $2
elif [ "$1" = "idle" ]; then 
    # infinite sleep to run user installation
    while true; do sleep 86400; done
else
    /usr/local/bin/bootstrap-kernel.sh
fi