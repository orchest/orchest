#!/usr/bin/env python3

import os
import sys
import subprocess
import logging
import time
import stat

logger = None


def dir_permissions(filepath):
  st = os.stat(filepath)
  return bool(st.st_mode & stat.S_IROTH) and bool(st.st_mode & stat.S_IWOTH) and bool(st.st_mode & stat.S_IXOTH)


def file_permissions(filepath):
  st = os.stat(filepath)
  return bool(st.st_mode & stat.S_IROTH) and bool(st.st_mode & stat.S_IWOTH)


def fix_path_permission(path, is_dir):

    if is_dir:
        if not dir_permissions(path):
            os.chmod(path, 0o757)
    else:
        if not file_permissions(path):
            os.chmod(path, 0o646)


def walk_dir(path):

    for dp, dirs, files in os.walk(path):
        for f in files:
            current_path = os.path.join(dp, f)
            fix_path_permission(current_path, os.path.isdir(current_path))
        for d in dirs:
            current_path = os.path.join(dp, d)
            fix_path_permission(current_path, os.path.isdir(current_path))


def main():
    logger = logging.getLogger('permission_app')
    logger.setLevel(logging.INFO)

    # create file handler which logs even debug messages
    # fh = logging.FileHandler('permission-app.log')
    # fh.setLevel(logging.DEBUG)
    # logger.addHandler(fh)

    if len(sys.argv) < 2:
        logger.debug("No directory specified")
        raise Exception("No directory specified")


    logger.info("Started permission logging")

    while True:
        walk_dir(sys.argv[1])
        time.sleep(1)


if __name__ == "__main__":
    main()

    
