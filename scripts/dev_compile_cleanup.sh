#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "Cleaning up dev symlinks"

# clean up symlinks
rm $DIR/../services/orchest-webserver/app/static/js/lib 2> /dev/null
rm $DIR/../services/auth-server/app/app/static/js/src/lib 2> /dev/null
