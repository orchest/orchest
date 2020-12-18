# This shell script is used to start either

# 1) the kernel for Jupyter or
# 2) the run.py to execute the container as a pipeline step.

umask 002

if [ "$1" = "runnable" ]; then 
    python run.py "$2" "$3"
else
    /usr/local/bin/bootstrap-kernel.sh
fi