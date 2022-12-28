# Implementation details

These implementation details are great to consult when working on the product as they describe in
detail how features work.

## Orchest Controller

Let's quickly go through how the Orchest Controller "reacts" on the state of the Kubernetes cluster.

In `controller.go` a number of _Informers_ are set up. These _Informers_ (not written by us) store
the applicable (depending on how you configure the informat) content from the k8s api in memory
(functioning as cache). This in-memory store is kept in sync with the state of the cluster using a
`watch` command. To minimize the load on the k8s api an `informerFactory` is used (again not
implemented by us).

Next, we add _event handlers_ on the informers to watch for particular events, e.g. the creation of
a Pod. Whenever an event handler is triggered the respective event handler enqueues the task. This
is where the `orchest-controller` comes in. The Orchest Controller consumes tasks from the respective
queues and handles it accordingly. An important note to make is that the Orchest Controller will
always make a deepcopy of objects as to not change the objects in the informer's cache.

Note, that there is one go routine per queue as to not concurrently work on tasks from the same
queue.

### Specification

#### Specifying custom images in the `OrchestCluster` CR

Details can be found here: [PR #1205](https://github.com/orchest/orchest/pull/1205).

In short, a custom image can be specified for an Orchest service. This image can have a custom
registry, name and/or tag. When the custom image is specified in the `OrchestCluster` CR on
creation, then the `orchest-controller` will deploy the image to be used.

On `orchest update` all non-custom images will be updated as regular, whereas custom images will
remain unchanged.

## Telemetry Events

The Orchest shared library provides a module
(`lib/python/orchest-internals/_orchest/internals/analytics.py`) which allows to send events to
our telemetry backend. The caller of this module, needs, essentially, to provide an **already
anonymized** payload (a dictionary) to the `send_event` function along with the event type to
send, e.g. `project:created`.

If you are tasked with adding new telemetry events, you should:

- find when the event takes place and when to send the telemetry event
- decide the type/name of the event, see the `analytics` module for examples. The event
  type must be defined in that module to be sent.
- decide what data to include in the payload.
- send the event.
- if you have access to it, check out our internal analytics backend to make sure the event arrived
  as expected.

If you are looking for a **list of telemetry events that are sent out**, see the `Event`
enumeration in the shared `analytics` module.

### Telemetry events from the `orchest-webserver`

This is the simplest case, where you will usually end up calling `send_event` in the same endpoint
that produces the event. Overall, sending a telemetry event translates to a piece of
logic similar to this:

```python

from _orchest.internals import analytics

analytics.send_event(
    app,
    analytics.Event.HEARTBEAT_TRIGGER,
    analytics.TelemetryData(
        event_properties={"active": active},
        derived_properties={},
    ),
)
```

### Telemetry events from the **front-end client**

The client sends telemetry events by using the `orchest-webserver` as a relay, essentially,
the `orchest-webserver` exposes the `/analytics` endpoint (`services/orchest-webserver/app/app/views/analytics.py`)
which allows the client to send events as long as the event type exists in the shared `analytics`
module. The payload should look like the following:

```python
{
  "event": "my event type",  # e.g. "project:created".
  # Must not contain any sensitive data, i.e. already anonymized.
  "properties": {
    "hello": "world"
  }
}
```

### Telemetry events from the `orchest-api`

The `orchest-api` will automatically take care of sending the telemetry event to the analytics
backend, asynchronously and with retries, once the event is registered in the `orchest-api` event
system. A complex way of saying that:

- the `orchest-api` has its own event system.

- each `orchest-api` event is also defined as an event in the `analytics` module and sent out to
  the analytics backend.

- as a "user" of this system, you will have to implement the event (i.e. the content of the
  payload), and register the event when it happens, the equivalent of calling
  `register_event(my_event)` in the right places.

See {ref}`Orchest-api Events <telemetry-orchest-api>` for a more in depth explanation.

(telemetry-orchest-api)=

## `orchest-api` events

The `orchest-api` keeps track of a number of events happening in Orchest, in fact, a dedicated
models module related to events exists, models implemented by the `orchest-api` can be found at
`services/orchest-api/app/app/models/` .

Events are used by the `orchest-api` for two reasons: to send them as telemetry events to the
analytics backend, and to use them for user facing notifications. Orchest implements a simple
subscription system where subscribers can subscribe to a number of events. A possible subscriber is
a "webhook", which users can use to get notified of particular events. An analytics subscriber
subscribed automatically to all events exists, which will automatically send out telemetry
events when `orchest-api` events are recorded.

When you record an `orchest-api` event, subscribers that are subscribed to that
event type will trigger the creation of a delivery record, which is stored in the database
and acts as a transactional outbox. The `celery-worker` will periodically check for undelivered
deliveries and send them out. Different deliverees (webhooks, analytics, etc.) have
different delivery implementations.

`orchest-api` events are implemented through a hierarchy of models backed by a single table
through single table inheritance. Each one of those models must implement its own methods to be
converted to a notification or telemetry payload. Given the nested nature of entities in Orchest,
for example `project:job:pipeline_run`, what actually happens is that an event representing a
specific layer of this hierarchy will call the parent class to generate a payload, then add it's own
data to the payload, incrementally. See the events models for example.

Steps to implement a new `orchest-api` event:

- create the database model by extending an existing `Event` class. Implement
  `to_notification_payload`, which will return the payload that is exposed to
  users through notifications, and `to_telemetry_payload`, which will return
  the payload that is sent to the analytics backend. This last payload **must**
  be completely anonymized.

- create a schema migration file if the model introduces new columns, i.e.
  `bash scripts/migration_manager.sh orchest-api migrate`.

- in that same file, or in a new one, add new event types as required by adding
  records to the `event_types` table. The `EventType` model refers to such
  migrations, that you can use as examples.

- add the required `register_<event_type>_event` functions in the `services/orchest-api/app/app/core/events.py`
  module, these functions will be used to record the event in the `orchest-api`.

- use the functions you defined to register the event happening in the right places.

- add the event type to the `Event` enumeration of the shared analytics module.

- you can now test said event as a user facing notification and, if you have
  access to the analytics backend, you can make sure that the telemetry event is
  delivered (and anonymized!).

## SDK data passing

The {meth}`orchest.transfer.get_inputs` method calls {meth}`orchest.transfer.resolve` which, in
order to resolve what output data the user most likely wants to get, needs a timestamp of the most
recent output for every transfer type.

### Disk transfer

To be able to resolve the timestamp of the most recent write, we keep a file called `HEAD` for
every step. It has the following content: `timestamp, serialization`, where timestamp is specified
in isoformat with timespec in seconds.

## Internally used environment variables

When it comes to pipeline execution, each pipeline step is executed in its own environment. More
particularly in its own container. Depending on how the code inside a pipeline step is executed a
number of ENV variables are set by Orchest. The different ways to execute code as part of a pipeline
step are:

- Running the cell of a Jupyter Notebook in JupyterLab,
- Running an interactive run through the pipeline editor,
- Running a non-interactive run as part of a job.

In all of the above mentioned cases the following ENV variables set: `ORCHEST_PROJECT_UUID`,
`ORCHEST_PIPELINE_UUID` and `ORCHEST_PIPELINE_PATH`. Then there is `ORCHEST_STEP_UUID`, which is
used for data passing, this ENV variable is always present in (non-)interactive runs and in the
Jupyter Notebooks after the first data passing using the {ref}`Orchest SDK`. Additionally, you can
use the following code snippet to get the UUID of the step if it is not yet set inside the
environment:

```python
import json
import orchest

# Put in the relative path to the pipeline file.
with open("pipeline.orchest", "r") as f:
    desc = json.load(f)

p = orchest.pipeline.Pipeline.from_json(desc)
step_uuid = orchest.utils.get_step_uuid(p)
```

Lastly, there is `ORCHEST_PROJECT_DIR` which is used to make the entire project directory available
through the JupyterLab UI and is thus only set for interactive Jupyter kernels.

## Building environment and custom jupyter images

Environment and custom JupyterLab images are built directly on the node by talking to the container
runtime. This allows faster builds given that we can push the image to the internal registry later
and asynchronously with respect to the actual build.

When a build is started by the user, a task in the `celery-worker` will create a pod in charge of
getting in touch with the container runtime and following the build. We let k8s schedule the pod on
any node it prefers, but we keep track of it for later use. The celery task following the build will
stream the logs of the building pod to the client through a websocket connection, with the websocket
server being the `orchest-webserver`.

Once the build is done, the image is pushed to the internal registry by the `node-agent`, a
`daemonset` that is in charge of a number of activities that need to happen on every node. This
happens transparently, meaning that the build will be considered done the moment the image is built,
and not after it has been pushed, and the user will be able to use that image immediately, e.g.
through a pipeline run.

### Distributing the image around the cluster

In a single node cluster there are no other nodes to pull the image into, but built images are
pushed to the internal registry regardless. This is because the k8s garbage collection task could
delete images from the node in case of disk pressure. If that happens, the `node-agent` will pull
the image back into the node by pulling it from the internal registry.

In a multi node cluster things are slightly different, but not that much: on each node, the
`node-agent` will check if the image is on the node, and, if not, will pull the image from the
registry. Once an image is pulled on a node the `orchest-api` is notified by the `node-agent`. This
information is used later for scheduling pods.

To summarize, given `N` nodes:

- the image is built using the container runtime, it's now on `1` node.
- the `node-agent` running on the node notices the new image, and pushes it to the registry.
- the `node-agent` pods running on the other `N - 1` nodes notice (by querying the `orchest-api`)
  that there is an image that is on the registry but not on the node, they pull the image.
- the image is now on all `N` nodes. If the image gets deleted from a node by k8s garbage collection
  it will be pulled again.

### Interfacing with different container runtimes

Talking directly to the container runtime gives us flexibility but also the burden of taking care of
every quirk or leaky abstraction related to the particular runtime we are interfacing with. The
points of interest in our logic, i.e. where changes related to container runtimes are likely to
happen, are the `orchet-api` module in charge of building images and the `orchest-controller`, which
might have to change some Orchest cluster level configuration based on the runtime.

#### Docker

When it comes to docker things are pretty easy, we just mount the docker socket from the host in the
builder pod, which image contains the `docker-cli`, and build the image through that.

#### Containerd

Things are slightly more complex when it comes to `containerd`. Since `containerd` doesn't offer an
high level way of building images we use `buildkit` to indirectly interface with it for builds.
Differently from the simple `docker` case, we can't just launch a builder pod containing an
ephemeral `buildkit` daemon and mount the `containerd` socket to said pod because bidirectional
mounting propagation is required in order to make this work when the `buildkit` daemon runs in a
container and `containerd` runs on the host, and we considered continuously creating and bringing
down the daemon too risky when it comes to leaving dangling mounts on the host.

Given that, when the `containerd` runtime is detected a `buildkitd` daemonset is created. Now that
we have a `buildkit` daemon running on every node, building becomes similar to the `docker` case,
the builder pod contains the `buildctl` CLI and mounts the `buildkitd` socket, the image is then
built by issuing `buildctl` commands. To clarify, this means that the `buildkitd` socket is exposed
to the host through a volume mount, and is then "picked up" by the builder pod by mounting the same
location from the host.

## Pod scheduling in Orchest

In order to provide a better user experience, Orchest distinguishes activities between what could be
called an "interactive scope" and a "non-interactive scope". The interactive scope includes any
activity where the user is directly involved in waiting to continue its tasks. For example, an
interactive pipeline run, a Jupyter kernel starting, waiting for an interactive session to be ready,
etc. Obviously, we want to make events part of this scope happen as quickly as possible.

Given this premise, and the fact that the `orchest-api` knows on which node(s) an environment image
is, Orchest interacts with the scheduling of pods of interest in order to have the best user
experience while balancing node pressure across the cluster. The entire logic can be found in the
`pod_scheduling.py` module of the `orchest-api`, and it's, at the high level, pretty simple:
anything that belongs to the **interactive scope** is scheduled to be **on any node that already
contains the images**, while the **non-interactive scope** is scheduled **on any node**,
regardless of the fact that the image is there already or if a pull will be needed.

This means that no pull will be needed to start pods related to the interactive scope, reducing the
time that the user would have to wait if, for example, the pod backing a step of an interactive run
would, instead, have been scheduled on a node that doesn't have the image already.

Example:

- a user imports a project containing one environment.
- the environment is built on the node.
- immediately after the image has been built, the user can start a session, start an interactive
  run, interact with a Jupyter kernel. These will all be scheduled on the node already containing
  the image.
- the image gets pushed to the registry by the `node-agent`.
- after the image has been pushed to the registry and pulled to the other nodes, all these
  activities belonging to the interactive scope could be scheduled on any node. This means that the
  time window during which there is single node pressure is given by the time it takes to push the
  newly built image to the registry and spread it to the other nodes.

## Git config and SSH keys injection

The `/auth-users/` API endpoints of the `orchest-api` allows setting up a git configuration (name,
email) and a number of SSH private keys for an auth user. When it comes to the git configuration, it
is set for `environment-shells`, the `jupyter server` and `git imports` by manipulating the command
and arguments of the deployment/pod.

When it comes to private SSH keys, those are only injected for the `jupyter server` and `git imports`, first, the keys are setup as volumes mounted into the pod, then, those are read up by some
simple bash logic which is injected by, again, by manipulating the command and arguments of the
deployment/pod. By making use of agent forwarding, the `environment shell` will be able to make use
of those keys seamlessly since the ssh connection of the shell starts from the `jupyter server`.

All of this happens only if the `orchest-api` is made aware that an interactive session or git
import is requested by a particular auth user. This is responsibility of the `orchest-webserver` ,
which acts as a proxy for all client -> `orchest-api` interactions, and in this context will add the
auth user uuid to the payload destined to be consumed by the `orchest-api`.
