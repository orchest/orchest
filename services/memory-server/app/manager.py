import json

import networkx as nx
import pyarrow.plasma as plasma


def construct_pipeline(pipeline_fname):
    """Construct pipeline from pipeline.json"""
    with open(pipeline_fname, "r") as f:
        description = json.load(f)

    try:
        auto_eviction = description["settings"].get("auto_eviction", False)
    except KeyError:
        auto_eviction = False

    pipeline = nx.DiGraph(auto_eviction=auto_eviction)

    # If an interactive session is started the first time on a newly
    # created pipeline. Then the `pipeline.json` will not have a `steps`
    # key, since the pipeline does not yet have steps.
    steps = description.get("steps")
    if steps is None:
        return pipeline

    # Create and add nodes.
    uuids = steps.keys()
    pipeline.add_nodes_from(uuids)

    # Create and add edges with weight zero.
    all_edges = []
    for uuid, info in steps.items():
        edges = [(conn, uuid, 0) for conn in info["incoming_connections"]]
        all_edges.extend(edges)

    pipeline.add_weighted_edges_from(all_edges)

    return pipeline


# NOTE: changes new it in place.
def propagate_weights(old, new):
    """Add old weights to new pipeline."""
    # Add weights from the previous pipeline to the new pipeline. Only
    # weights for still existing edges are propagated.
    for edge in new.edges:
        s, t = edge

        try:
            new[s][t]["weight"] = old[s][t]["weight"]
        except KeyError:
            # Hit if the edge does not exist in the previous pipeline.
            pass


def get_uuids_to_evict(pipeline):
    """Go over entire pipeline and check for objects to evict."""
    uuids = []
    for uuid in pipeline.nodes:
        out_degree = pipeline.out_degree(uuid)
        num_uniq_receivers = pipeline.out_degree(uuid, weight="weight")

        # For these we want to do eviction.
        if out_degree == num_uniq_receivers:
            uuids.append(uuid)

    return uuids


# TODO: could actually import this from orchest.transfer
def _convert_uuid_to_object_id(uuid):
    bin_uuid = str.encode(uuid)
    return plasma.ObjectID(bin_uuid[:20])


# Evict objects by uuid
def delete(client, uuids):
    # Just a wrapper of the apache arrow plasma client.delete().
    bin_uuids = [_convert_uuid_to_object_id(uuid) for uuid in uuids]

    # No error is raised in case an ID is not in the store. It passes
    # silently, since in essence it is actually succeeding.
    client.delete(bin_uuids)


def start_manager(store_socket_name, pipeline_fname):
    # Connect to the plasma store and subscribe to its notification
    # socket.
    client = plasma.connect(store_socket_name)
    client.subscribe()

    # Keeps a `pipeline` in memory to maintain state. Everytime a step
    # retrieves the output from another the weight of that connection
    # (aka edge) is set to 1. If the outdegree of a step is equal to the
    # sum of the weight of its outgoing edges, then we know that all the
    # receiving steps have already read the output. If the
    # `auto_eviction` is set in the `pipeline.json`, then this will
    # cause that output to be removed from the store.
    pipeline = construct_pipeline(pipeline_fname=pipeline_fname)

    while True:
        try:
            obj_id, data_size, mdata_size = client.get_next_notification()
            print("Got new notification")
        except OSError:
            # "Failed to read object notification from Plasma socket"
            print("Failed to read object notification from Plasma socket")
            continue

        mdata = client.get_metadata([obj_id], timeout_ms=1000)

        # Whenever a sealed object is deleted, it also triggers a
        # notification. However, we do not need to check for eviction in
        # that case.
        if mdata[0] is None:
            continue

        # TODO: change print to logging to stdout
        print("Received:", obj_id)
        mdata = bytes(mdata[0])

        # An example message: b'2;uuid-1,uuid-2'. Meaning that step with
        # 'uuid-2' has retrieved the output from step with 'uuid-1'.
        identifier, _, mdata = mdata.partition(b";")
        if identifier != b"2":
            continue

        decoded_mdata = mdata.decode(encoding="utf-8")
        source, target = decoded_mdata.split(",")

        # Create new pipeline and propagate weights. A new pipeline is
        # created to account for a possible change in the pipeline. A
        # user might have added or removed multiple steps or
        # connections.
        new_pipeline = construct_pipeline(pipeline_fname=pipeline_fname)
        propagate_weights(pipeline, new_pipeline)

        # The `pipeline` instance is kept in memory so that the state of
        # the eviction manager is maintained during the lifecycle of the
        # store.
        pipeline = new_pipeline

        # Set that the target uuid has received from the source.
        pipeline[source][target]["weight"] = 1

        # TODO: should we check for this options earlier, because
        #       probably we want to start counting the moment the user
        #       selects the options (and by deselect maybe reset all
        #       weights to zero).
        # Only consider evicting objects if the option is set.
        if not pipeline.graph.get("auto_eviction", False):
            continue

        # Delete the objects corresponding to the `uuids_to_evict`.
        uuids_to_evict = get_uuids_to_evict(new_pipeline)
        delete(client, uuids_to_evict)

        print("Evicting:", uuids_to_evict)

        # Need to also delete the "ping" object that contained the
        # metadata.
        client.delete([obj_id])
