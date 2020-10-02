#!/usr/bin/env bash

./generate-dummy-certs.sh

sudo cp server.crt /etc/ssl/certs/server.crt
sudo cp server.key /etc/ssl/certs/server.key

# cleanup
rm server.crt server.key cert.csr