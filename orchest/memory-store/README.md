```bash
docker build -t plasma-manager .

# Currently this is just for testing. Later the socket will be put
# inside the userdir and the mount will be straightforward.
# Probably: -v $PIPELINE-DIR/.orchest/:/tmp
# Note that the socket is created inside the container and does not
# exist beforehand on the host.
mkdir /tmp/memory-store
docker run -v /tmp/memory-store:/tmp plasma-manager
```
