# Orchest CLI

[Website](https://www.orchest.io) —
[Docs](https://docs.orchest.io/en/stable/)

---

Python package for interacting with the [Orchest](https://github.com/orchest/orchest) application
on your Kubernetes cluster.

## Installation

```sh
pip install orchest-cli
```

## Development

1. Create the Orchest namespace, e.g. `kubectl create ns orchest`. This should later be done by the
   `orchest-cli`. Without the namespace creating the namespaced CRD and controller won't work.
2. Build the controller's `Dockerfile` on the `minikube` node, using
   `scripts/build_container.sh -v -i orchest-controller -t "latest"`. Or run `make build` in the
   `orchest-controller` directory.
3. Deploy the `orchest-controller` (can be done together with the next step using
   `kubectl -f apply services/orchest-controller/deploy-controller`). These files point to
   `orchest-controller:latest` therefore the `"latest"` is provided in the previous step.
4. Deploy the CRD. This will allow us to create a new custom resources (CR) that will be managed by
   the `orchest-controller`

`orchest install`:

- Will take care of creating a CR Object (according to the CRD). Alternatively, you can run the
  appropriate `kubectl apply -f ...`
- To try it out you need to delete the CR Object, e.g.:
  `kubectl -n orchest delete orchestcluster cluster-1`, after every run of `orchest install`. To run
  the CLI, simply create a virtualenv (`python3 -m venv venv`) and install the CLI
  (`pip install -e .`)

Deploying a new controller:

- Build the new controller (`make build`).
- Remove the CR Object, which will also remove the corresponding row in etcd, so that we can start from
  scratch when deploying a new controller. Go to `orchestcluster` in k9s, or using `kubectl`:
  `kubectl -n orchest delete orchestcluster cluster-1`
- Remove the old controller. This will immediately create a new pod (since it is a deployment)

### Notes

- The exact schema can be found in `services/orchest-controller/pkg/apis/orchest/v1alpha1/types.go`
- `STATUS` endpoint is not yet implemented, but good to add later so that commands like
  `kubectl -n orchest get orchestclusters` have the expected output (including a `STATUS` column).
  Also then we can get just the status instead of the entire object.

TODO:

- [ ] Check with old CTL whether we have all the functionality we need.
  - [ ] `uninstall` to delete CR Object and then delete `orchest` namespace? Can also tell users to
        delete their cluster if they were using it solely for Orchest.
- [ ] GitHub Action workflow files to publish CLI on release
- [ ] CLI module docstring explaining architecture, e.g. manag. cmds and appl cmds
- [ ] Structure of CLI code
- [ ] Installation docs (and how to self-host as you might need nginx reverse-proxy)
  - [ ] We will recommend to install Orchest on a clean cluster (a non-existing cluster) because
        it is hard to play well with other software already installed on the cluster, e.g. ingress,
        argo, etc.
  - [ ] Open an issue to fix the above point.
  - [ ] Show usage of CLI and direct yaml apply. The controller will get a service and ingress rule
        as well.
- [ ] TODOs in `cli.py`
- [ ] `update` and `restart` to work in the GUI
- [x] Make sure `cleanup` is invoked on certain actions, e.g. restart/pause.
- [x] Are ingresses etc. working?
- [ ] Whenever the CRD is changed, users need to `kubectl apply` its changes. Otherwise the
      controller might use fields that aren't defined yet. So we need a robust first version of the CRD.
- [ ] Stay with `update` and not go with `upgrade`
  - [ ] `update` for CLI to just get CR Object status. Or do we poll from endpoint as well given
        that the two paths are then the same and it is better for future versions of the CLI?
- [x] "Deploying Orchest" --> "Deploying Orchest control plane"
- [ ] Removal of `orchest-ctl` from codebase (and changes to `namespace_ctl.py`)
- [x] Great CRD
- [ ] Tests? Could also be as simple as running a type checker for now.
- [x] `orchest restart` doesn't work when invoked through the `orchest-api` because it requires two
      CR changes (but no process will be running to invoke the second one).
- [x] Additional flags / options / file to specify installation
- [ ] `orchest-controller` needs to be versioned as well instead of "latest"
- [x] Cluster is never put into `Paused` after pausing
  - [ ] Unpausing (so doing `pause: false`) results in the cluster status being set to `Updating`
- [ ] I think it would be nice to have a visualization indicating the different state transitions
      the operator makes. Sort of a state machine.
  - [ ] Note that the `docker-registry` is managed through Helm and not the `orchest-controller`.

### Questions

- How about the ingress addon?
- Do we want to install the `orchest-controller` in a dedicated namespace. Otherwise it could become
  "impossible" to delete the `orchest` cluster (due to the finalizer on the CRD).
