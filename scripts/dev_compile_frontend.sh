#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "[Debug = true] starting webpack & sass watchers..."

# Create symlinks
rm $DIR/../services/orchest-webserver/app/static/js/src/lib 2> /dev/null
ln -s $DIR/../lib/javascript $DIR/../services/orchest-webserver/app/static/js/src/lib

rm $DIR/../services/auth-server/app/static/js/src/lib 2> /dev/null
ln -s $DIR/../lib/javascript $DIR/../services/auth-server/app/static/js/src/lib

NPM_INSTALL=false

while getopts ":-:" opt; do
  case ${opt} in
    -)
      case "${OPTARG}" in
        install)
          NPM_INSTALL=true
          ;;
      esac
      ;;
  esac
done

if $NPM_INSTALL; then
  echo "Installing npm packages..."
  cd $DIR/../services/orchest-webserver/app/static/; npm install &
  cd $DIR/../services/auth-server/app/static/; npm install
fi

cd $DIR/../services/orchest-webserver/app/static/; ./watch-compile-js.sh &
cd $DIR/../services/orchest-webserver/app/static/; ./watch-compile-sass.sh &
cd $DIR/../services/auth-server/app/static/; ./watch-compile-js.sh &
cd $DIR/../services/auth-server/app/static/; ./watch-compile-sass.sh
