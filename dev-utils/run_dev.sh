#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "[Debug = true] starting webpack & sass watchers..."
gnome-terminal --geometry=154x84+0+0 --working-directory=$DIR/../orchest/orchest-webserver/app/static/ -- "./compile-js.sh" 
gnome-terminal --geometry=154x84+0+0 --working-directory=$DIR/../orchest/orchest-webserver/app/static/css/ -- "./watch-compile-sass.sh" 