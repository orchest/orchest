#! /usr/bin/env python3

import sys
import os
import pathlib

ROOT_PATH = str(pathlib.Path(__file__).parent.absolute())
APP_PATH = os.path.join(ROOT_PATH, "app")

if len(sys.argv) <= 1 or len(sys.argv[1]) < 1:
    # nginx accepts _ as a catch-all domain
    DOMAIN = "_"
else:
    DOMAIN = sys.argv[1]


with open("nginx-template.conf", 'r') as f:
    file = f.read()
    file = file.replace("$DOMAIN$", DOMAIN)
    file = file.replace("$APP_PATH$", APP_PATH)

with open("update-service", "w") as f:
    f.write(file)


with open("update-service-template.service", 'r') as f:
    file = f.read()
    file = file.replace("$ROOT_PATH$", ROOT_PATH)

with open("update-service.service", "w") as f:
    f.write(file)