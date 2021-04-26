#! /usr/bin/env bash

pip_init_location=$(pip show pip | grep Location: | awk '{print $2}')/pip/__init__.py
python_snippet=$(cat /pip-warning.py)

if test -f "$pip_init_location"; then
    init_contents=$(cat $pip_init_location)
    if ! [[ $init_contents == *"# PATCH MARKER: uh9999x"* ]]; then
        # Patch
        echo -e "$python_snippet\n$(cat $pip_init_location)" > "$pip_init_location"
    fi
fi