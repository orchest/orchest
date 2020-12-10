#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "[Debug = true] starting webpack & sass watchers..."

# Create symlinks
rm $DIR/../services/orchest-webserver/app/static/js/lib 2> /dev/null
ln -s $DIR/../lib/javascript $DIR/../services/orchest-webserver/app/static/js/lib

rm $DIR/../services/auth-server/app/static/js/src/lib 2> /dev/null
ln -s $DIR/../lib/javascript $DIR/../services/auth-server/app/static/js/src/lib

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
  (cd $DIR/../services/orchest-webserver/app/static/; npm install)
fi

(cd $DIR/../services/orchest-webserver/app/static/; ./watch-compile-js.sh &)
(cd $DIR/../services/orchest-webserver/app/static/; ./watch-compile-sass.sh &)


if $NPM_INSTALL; then
  (cd $DIR/../services/auth-server/app/static/; npm install)
fi

(cd $DIR/../services/auth-server/app/static/; ./watch-compile-js.sh &)
(cd $DIR/../services/auth-server/app/static/; ./watch-compile-sass.sh)
