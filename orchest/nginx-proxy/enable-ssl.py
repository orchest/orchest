#! /usr/bin/env python3

import sys

if len(sys.argv) <= 1:
    print("ERROR: expecting a domain parameter as the first argument.")

with open("ssl.conf-template") as f:
    ssl_conf = f.read()

with open("orchest.conf", 'r') as f:
    file = f.read()
    file = file.replace("# enable-ssl", ssl_conf)
    file = file.replace("server_name localhost;", sys.argv[1])

with open("orchest.conf", "w") as f:
    f.write(file)