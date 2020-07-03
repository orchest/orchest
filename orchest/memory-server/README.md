```bash
docker build -t plasma-manager --build-arg sdk_branch="feature-memory" .


# Currently this is just for testing. Later the socket will be put
# inside the userdir and the mount will be straightforward.
# Probably: -v $PIPELINE-DIR/.orchest/:/tmp
# Note that the socket is created inside the container and does not
# exist beforehand on the host.
mkdir /tmp/memory-server
docker run -v /tmp/memory-server:/tmp memory-server
```

```
docker run -v $PWD/50007db4-ea30-44e1-aefb-969d3f8c2ca5/store:/tmp -v $PWD/50007db4-ea30-44e1-aefb-969d3f8c2ca5:/notebooks orchestsoftware/memory-server:latest
```
