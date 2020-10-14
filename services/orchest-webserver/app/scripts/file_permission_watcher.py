#!/usr/bin/env python3

import os
import sys
import subprocess
import logging
import time

logger = None

def fix_path_permission(path, is_dir):

    # logger.debug(path)
    if is_dir:
        subprocess.Popen("chmod o+rwx " + path, shell=True)
    else:
        subprocess.Popen("chmod o+rw " + path, shell=True)


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
        time.sleep(0.5)


if __name__ == "__main__":
    main()

    
