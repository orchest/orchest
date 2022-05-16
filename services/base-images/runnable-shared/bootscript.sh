#!/usr/bin/env bash

# This shell script is used to start either

# 1) the kernel for Jupyter or
# 2) the run.py to execute the container as a pipeline step.

umask 002

if [ "$1" = "runnable" ]; then
    /home/$NB_USER/venv/bin/python \
    /orchest/services/base-images/runnable-shared/runner/run.py  "$2" "$3"
else

    # This bootscript is generic and also runs for images without conda
    if command -v conda 
    then
        # In non-interactive shell the conda environment can not be
        # activated without initializing the shell. For some reason
        # (which I sadly do not understand) the `eval` approach is the
        # only one that works. Others I have tried (but failed) are:
        # * source /opt/conda/etc/profile.d/conda.sh
        # Additionally (although unclear from the docs), `conda run` is
        # considered experimental and is known to break often. Lastly,
        # straight up altering the PATH directly should also not be used
        # as environment activation might take care of additional
        # environment variables that need to be set.
        eval "$(conda shell.bash hook)"

        # Use the Python specified by $CONDA_ENV to start the kernel.
        conda activate "$CONDA_ENV"
    fi


    /usr/local/bin/bootstrap-kernel.sh
fi
