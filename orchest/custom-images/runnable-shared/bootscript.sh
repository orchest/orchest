# This shell script is used to start either

# 1) the kernel for Jupyter or
# 2) the run.py to execute the container as a pipeline step.

if [ "$1" = "runnable" ]; then 
    sudo python run.py
else
    /usr/local/bin/bootstrap-kernel.sh
fi