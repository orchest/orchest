# orchest-deployment

This directory contains all the Kubernetes deployments.

We opted to use Helm to facilitate configuration changes and to make the repos suitable to different
environments.

## Important notes:

The orchest helm charts are located in the <strong>helm</strong> directory, the contents of the
<strong>thirdparty</strong> directory are imported from other third party components which are
needed for Orchest to run and are added for sake of completeness.

# How to use?

The Makefile is configured to do the most common actions and it can be configured using envirement variables.

1. `NAMESPACE` this will be the namespace where orchest and its dependencies are going to be deployed, default value is `orchest`
2. `KUBECONFIG` the location of the k8s configuration file, default value is `~/.kube/config`
3. `DEBUG` if specified, helm is executed with `--debug --dry-run`

The following targets are defined:

1. `orchest` to deploy orchest in the cluster
