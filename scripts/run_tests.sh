#!/bin/bash

# To display help run this script with the "--help" option.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
SERVICES=()
TRACEBACK="line"

# When running this script on GitHub Actions, we do not have to create a
# virtualenv to install the dependencies in.
USE_VENV=true

while getopts "s:t-:" opt; do
  case ${opt} in
    s)
      SERVICES+=($OPTARG)
      ;;
    t)
      TRACEBACK="auto"
      ;;
    -)
      if [ $OPTARG == "no-venv" ]; then
          USE_VENV=false
      fi
      if [ $OPTARG == "help" ]; then
          echo "Usage:"
          echo "--help        Display help."
          echo "--no-venv     Run without virtualenv."
          echo "-s            Run test for a specific service."
          echo "-t            Set --tb=auto for pytest."
          exit 0
      fi
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

# If no services are specified, then we want to run the tests for all of
# them.
if [ ${#SERVICES[@]} -eq 0 ]; then
    SERVICES=(
        "jupyter-server"
        "orchest-api"
        "memory-server"
    )
fi


VENVS_DIR=$DIR/../.venvs
mkdir -p $VENVS_DIR


for SERVICE in ${SERVICES[@]}
do
    VENV="$VENVS_DIR/$SERVICE"
    if [ ! -d $VENV -a $USE_VENV ]; then
        echo "[$SERVICE]: Creating virtualenv..."
        # TODO: python3 should map to 3.7 specifically?
        virtualenv -p python3 "$VENV" > /dev/null 2>&1
    fi

    if $USE_VENV; then
        source $VENV/bin/activate
    fi

    # Install requirements.txt
    echo "[$SERVICE]: Installing dependencies..."

    if [ $SERVICE == "jupyter-server" ]; then
        REQ_DIR=$DIR/../orchest/jupyter-server/app
        TEST_DIR=$REQ_DIR
    fi
    if [ $SERVICE == "orchest-api" ]; then
        REQ_DIR=$DIR/../orchest/orchest-api/app
        TEST_DIR=$REQ_DIR
    fi
    if [ $SERVICE == "memory-server" ]; then
        REQ_DIR=$DIR/../orchest/memory-server
        TEST_DIR=$REQ_DIR
    fi

    cd $REQ_DIR
    pip install -r requirements.txt pytest > /dev/null 2>&1

    # Run tests.
    cd $TEST_DIR
    python -m pytest -v --disable-warnings --tb=$TRACEBACK tests

    # Deactivate the virtualenv.
    if $USE_VENV; then
        deactivate
    fi
    echo
done
