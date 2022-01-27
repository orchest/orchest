#!/bin/bash

# This script restores the userdir to the state in the git repository
# (of the latest local commit).

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "[Cleaning up userdir]: ..."

# Removes the userdir and then restores the structure imposed on the
# userdir by the git repository. Restoring all defaults such as
# .gitignore files.
sudo rm -rf $DIR/../userdir
git checkout $DIR/../userdir

echo "[Cleaning up userdir]: success"

# The find command includes setting the sticky bit on the userdir
# directory itself.
echo "Setting the right permissions on the userdir..."
find $DIR/../userdir -type d -not -perm -g+s -exec chmod g+s {} \;
