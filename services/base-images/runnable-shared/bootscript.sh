# This shell script is used to start either

# 1) the kernel for Jupyter or
# 2) the run.py to execute the container as a pipeline step.

umask 002

if [ "$1" = "runnable" ]; then
    /opt/conda/envs/orchestdependencies/bin/python run.py "$2" "$3"
else
    # Use the Python specified by $CONDA_ENV to start the kernel.
    [ -n "$CONDA_ENV" ] && export PATH="/opt/conda/envs/$CONDA_ENV/bin:$PATH"
    /usr/local/bin/bootstrap-kernel.sh
fi
