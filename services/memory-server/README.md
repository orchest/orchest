# memory-server

Docker container running a Plasma store (from the Apache Arrow project) together with a custom
manager for eviction of objects.

Objects are evicted according to a call-graph (in our case the `pipeline.json`) if all connected
nodes have received the data from the source.

```bash
# Specify the branch of the sdk to use when installing the server. It
# defaults to master.
docker build -t orchest/memory-server --build-arg sdk_branch="master" .
```
