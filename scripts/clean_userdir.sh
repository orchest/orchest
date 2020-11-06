#!/bin/bash

# This script cleans the userdir (while leaving the root .gitignore files
# intact)

if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "[Cleaning up userdir]: ..."

# clean up symlinks
for component in .orchest/rabbitmq-mnesia .orchest/kernels projects experiments
do
find $DIR/../userdir/$component -mindepth 1 -maxdepth 1 ! -name ".gitignore" -exec rm -rf -- {} +
done

echo "[Cleaning up userdir]: succes"