import json

import networkx as nx
import pyarrow.plasma as plasma


def construct_pipeline(pipeline_fname='pipeline.json'):
    """Construct pipeline from pipeline.json"""
    with open(pipeline_fname, 'r') as f:
        description = json.load(f)

    pipeline = nx.DiGraph()

    # Create and add nodes.
    steps = description['steps']
    uuids = steps.keys()
    pipeline.add_nodes_from(uuids)

    # Create and add edges with weight zero.
    all_edges = []
    for uuid, info in steps.items():
        edges = [(uuid, conn, 0) for conn in info['outgoing_connections']]
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
            new[s][t]['weight'] = old[s][t]['weight']
        except KeyError:
            # Hit if the edge does not exist in the previous pipeline.
            pass


def get_uuids_to_evict(pipeline):
    """Go over entire pipeline and check for objects to evict."""
    uuids = []
    for uuid in pipeline.nodes:
        out_degree = pipeline.out_degree(uuid)
        num_uniq_receivers = pipeline.out_degree(uuid, weight='weight')

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
    client = plasma.connect(store_socket_name)

    client.subscribe()

    # This one should actually be kept in memory
    pipeline = construct_pipeline(pipeline_fname=pipeline_fname)

    while True:
        try:
            obj_id, data_size, mdata_size = client.get_next_notification()
        except OSError:
            # "OSError: Failed to read object notification from Plasma socket"
            continue

        print(obj_id)

        mdata = client.get_metadata([obj_id], timeout_ms=1000)
        print('mdata:', mdata)

        # This is the case when a sealed object is deleted. Then also
        # a notification is triggered. But we don't want to inspect
        # this one.
        if mdata[0] is None:
            continue

        mdata = bytes(mdata[0])

        # TODO: we should add some information about what it in the
        # metadata. Currently it can be all sorts of strings. This is
        # super hard to resolve.
        identifier, _, data = mdata.partition(b';')
        print(identifier, data)
        if identifier != b'2':
            continue

        decoded_mdata = data.decode(encoding='utf-8')
        source, target = decoded_mdata.split(',')

        # Create new pipeline and propagate weights.
        new_pipeline = construct_pipeline(pipeline_fname=pipeline_fname)
        propagate_weights(pipeline, new_pipeline)
        pipeline = new_pipeline

        # Set that the target uuid has received from the source.
        pipeline[source][target]['weight'] = 1

        # TODO: ONLY DELETE IF AUTO_EVICT OPTION IS SET IN PIPELINE.JSON
        # Delete the uuids to evict.
        uuids_to_evict = get_uuids_to_evict(new_pipeline)
        print(uuids_to_evict)
        print([type(uuid) for uuid in uuids_to_evict])
        delete(client, uuids_to_evict)

        # Need to also delete the object itself that contained the metadata.
        client.delete([obj_id])
