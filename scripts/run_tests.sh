#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
SERVICES=()
TRACEBACK="line"

while getopts "s:t" opt; do
  case ${opt} in
    s)
      SERVICES+=($OPTARG)
      ;;
    t)
      TRACEBACK="auto"
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

VENVS_DIR=$DIR/../.venvs
mkdir -p $VENVS_DIR


for SERVICE in ${SERVICES[@]}
do
    VENV="$VENVS_DIR/$SERVICE"
    if [ ! -d $VENV ]; then
        echo "[$SERVICE]: Creating virtualenv..."
        # TODO: python3 should map to 3.7 specifically?
        virtualenv -p python3 "$VENV" > /dev/null 2>&1
    fi

    source $VENV/bin/activate

    # Install requirements.txt and run tests.
    echo "[$SERVICE]: Installing dependencies..."

    if [ $SERVICE == "jupyter-server" ]; then
        cd $DIR/../orchest/jupyter-server/app
        pip install -r requirements.txt pytest > /dev/null 2>&1
        python -m pytest -v --disable-warnings --tb=$TRACEBACK
    fi
    if [ $SERVICE == "orchest-api" ]; then
        cd $DIR/../orchest/orchest-api/app
        pip install -r requirements.txt pytest > /dev/null 2>&1
        python -m pytest -v --disable-warnings --tb=$TRACEBACK
    fi
    if [ $SERVICE == "memory-server" ]; then
        cd $DIR/../orchest/memory-server
        pip install -r requirements.txt pytest > /dev/null 2>&1
        python -m pytest -v --disable-warnings --tb=$TRACEBACK
    fi

    # Deactivate the virtualenv.
    deactivate
    echo
done
