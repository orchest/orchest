#! /usr/bin/env python3

with open("ssl.conf-template") as f:
    ssl_conf = f.read()

with open("orchest.conf", 'r') as f:
    file = f.read()
    file = file.replace("# enable-ssl", ssl_conf)

with open("orchest.conf", "w") as f:
    f.write(file)