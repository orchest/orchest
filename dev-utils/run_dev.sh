#!/bin/bash

# compile-js requires `npx webpack` (install recent nodejs + npm and run `npm
# install` in compile-js.sh directory)

# watch-compile-sass requires `sass` (install recent nodejs + npm and run `npm
# install` in watch-compile-sass.sh directory)

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "[Debug = true] starting webpack & sass watchers..."
#gnome-terminal --geometry=154x84+0+0 --working-directory=$DIR/../orchest/orchest-webserver/app/static/ -- "./watch-compile-js.sh" 
#gnome-terminal --geometry=154x84+0+0 --working-directory=$DIR/../orchest/orchest-webserver/app/static/ -- "./watch-compile-sass.sh"

NPM_INSTALL=true

while getopts ":skip-install" opt; do
  case $opt in
    s)
      NPM_INSTALL=false
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

if $NPM_INSTALL; then
  (cd $DIR/../orchest/orchest-webserver/app/static/; npm install)
fi

(cd $DIR/../orchest/orchest-webserver/app/static/; ./watch-compile-js.sh &)
(cd $DIR/../orchest/orchest-webserver/app/static/; ./watch-compile-sass.sh)
