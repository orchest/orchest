#!/bin/bash

umask 002

while true; do
    ./main.py
    echo "'main.py' crashed with exit code $?. Restarting..." >&2
    sleep 1
done