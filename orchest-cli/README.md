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

- At this point in time the controller doesn't do anything yet.
- The exact schema can be found in `services/orchest-controller/pkg/apis/orchest/v1alpha1/types.go`
- `STATUS` endpoint is not yet implemented, but good to add later so that commands like
  `kubectl -n orchest get orchestclusters` have the expected output (including a `STATUS` column).
  Also then we can get just the status instead of the entire object.

### Questions

- How about the ingress addon?
