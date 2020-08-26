#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "Cleaning up dev symlinks"

# clean up symlinks
rm $DIR/../orchest/orchest-webserver/app/static/js/lib
rm $DIR/../orchest/auth-server/app/app/static/js/src/lib