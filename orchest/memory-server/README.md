```bash
docker build -t memory-server .

# Currently this is just for testing. Later the socket will be put
# inside the userdir and the mount will be straightforward.
# Probably: -v $PIPELINE-DIR/.orchest/:/tmp
# Note that the socket is created inside the container and does not
# exist beforehand on the host.
mkdir /tmp/memory-server
docker run -v /tmp/memory-server:/tmp memory-server
```
