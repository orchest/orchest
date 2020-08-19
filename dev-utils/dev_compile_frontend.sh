#!/bin/bash

# compile-js requires `npx webpack` (install recent nodejs + npm and run `npm
# install` in compile-js.sh directory)

# watch-compile-sass requires `sass` (install recent nodejs + npm and run `npm
# install` in watch-compile-sass.sh directory)

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "[Debug = true] starting webpack & sass watchers..."
#gnome-terminal --geometry=154x84+0+0 --working-directory=$DIR/../orchest/orchest-webserver/app/static/ -- "./watch-compile-js.sh" 
#gnome-terminal --geometry=154x84+0+0 --working-directory=$DIR/../orchest/orchest-webserver/app/static/ -- "./watch-compile-sass.sh"


# Create symlinks
rm $DIR/../orchest/orchest-webserver/app/static/js/lib
ln -s $DIR/../lib/javascript $DIR/../orchest/orchest-webserver/app/static/js/lib

rm $DIR/../orchest/auth-server/app/app/static/js/src/lib
ln -s $DIR/../lib/javascript $DIR/../orchest/auth-server/app/app/static/js/src/lib

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
(cd $DIR/../orchest/orchest-webserver/app/static/; ./watch-compile-sass.sh &)


if $NPM_INSTALL; then
  (cd $DIR/../orchest/auth-server/app/app/static/; npm install)
fi

(cd $DIR/../orchest/auth-server/app/app/static/; ./watch-compile-js.sh &)
(cd $DIR/../orchest/auth-server/app/app/static/; ./watch-compile-sass.sh)
