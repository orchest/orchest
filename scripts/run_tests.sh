#!/bin/bash

# NOTE: if there are problems with installing the dependencies in the
# virtualenvironment. Then you might need to run:
#       sudo apt install default-libmysqlclient-dev

set -e

# To display help run this script with the "--help" option.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# TODO: For the sake of ease, the orchest-sdk will be considered to be a
#       service as well. Once we support multiple languages for the sdk
#       this should be tested seperately.
SERVICES=()

# How to print the traceback for tests run with pytest.
TRACEBACK="line"

# When running this script on GitHub Actions, we do not have to create a
# virtualenv to install the dependencies in.
USE_VENV=true
VERBOSE=false

while getopts "s:tv-:" opt; do
  case ${opt} in
    s)
      SERVICES+=($OPTARG)
      ;;
    t)
      TRACEBACK="auto"
      ;;
    v)
      VERBOSE=true
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
          echo "-v            Run in verbose mode, don't capture output with pytest."
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
        "memory-server"
        "orchest-api"
        "orchest-sdk"
        "base-images-runnable"
    )
fi


VENVS_DIR=$DIR/../.venvs
mkdir -p $VENVS_DIR


for SERVICE in ${SERVICES[@]}
do
    VENV="$VENVS_DIR/$SERVICE"
    if [ ! -d $VENV ] && $USE_VENV; then
        echo "[$SERVICE]: Creating virtualenv..."
        # TODO: python3 should map to 3.7 specifically?
        virtualenv -p python3 "$VENV" > /dev/null 2>&1
    fi

    if $USE_VENV; then
        source $VENV/bin/activate
    fi

    # Install requirements.txt
    echo "[$SERVICE]: Installing dependencies..."

    if [ $SERVICE == "memory-server" ]; then
        TEST_DIR=$DIR/../services/memory-server
        REQ_DIR=$TEST_DIR
        REQ_FILE=$REQ_DIR/requirements-dev.txt
    fi
    if [ $SERVICE == "orchest-api" ]; then
        TEST_DIR=$DIR/../services/orchest-api/app
        REQ_DIR=$TEST_DIR/..
        REQ_FILE=$REQ_DIR/requirements.txt
    fi
    if [ $SERVICE == "orchest-sdk" ]; then
        TEST_DIR=$DIR/../orchest-sdk/python
        REQ_DIR=$TEST_DIR
        REQ_FILE=$REQ_DIR/requirements.txt
    fi
    if [ $SERVICE == "base-images-runnable" ]; then
        TEST_DIR=$DIR/../services/base-images/runnable-shared/runner
        REQ_DIR=$TEST_DIR
        REQ_FILE=$REQ_DIR/requirements-dev.txt
    fi


    cd $REQ_DIR
    if $USE_VENV; then
        pip install -r $REQ_FILE pytest > /dev/null
    else
        pip install -r $REQ_FILE pytest
    fi


    # Run tests.
    cd $TEST_DIR

    if $VERBOSE; then
        CAPTURE_FLAG="-s"
    fi

    python -m pytest -v $CAPTURE_FLAG --disable-warnings --tb=$TRACEBACK tests

    # Deactivate the virtualenv.
    if $USE_VENV; then
        deactivate
    fi
    echo
done
