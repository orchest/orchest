#!/bin/bash

# This script is called by the build_container.sh script. If it is called
# dev_compile_frontend.sh needs to be restarted to recreate the symlinks for
# the libraries.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "Cleaning up dev symlinks"

# clean up symlinks
rm $DIR/../services/orchest-webserver/app/static/js/src/lib 2> /dev/null
rm $DIR/../services/auth-server/app/static/js/src/lib 2> /dev/null
