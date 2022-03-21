# orchest-deployment

This directory contains all the Kubernetes deployments.

We opted to use Helm to facilitate configuration changes and to make the repos suitable to different
environments.

# Helm install and setup

    curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3
    sudo chmod 700 get_helm.sh
    ./get_helm.sh


## Important notes:

The orchest helm charts are located in the <strong>helm</strong> directory, the contents of the
<strong>thirdparty</strong> directory are imported from other third party components which are
needed for Orchest to run and are added for sake of completeness.

# How to use?

The Makefile is configured to do the most common actions and it can be configured using envirement variables.

1. `NAMESPACE` this will be the namespace where orchest and its dependencies are going to be
   deployed, the default value is `orchest`
2. `KUBECONFIG` the location of the k8s configuration file, the default value is `~/.kube/config`
3. `DEBUG` if specified, helm is executed with `--debug --dry-run`
4. `DEPEND_RESOURCES` if set to `FALSE` the `orchest` target is not dependent on `orchest-resources`
   target
5. `ROOK_CEPH_NAMESPACE` is the namespace for the deployment of rook/ceph. default : `rook-ceph`
6. `ROOK_NFS_NAMESPACE` the deployment namespace of rook/nfs, default: `rook-nfs`
7. `ENABLE_ROOK_NFS` enables the rook-nfs as a storage provider (if no storage is enabled, the
   `ENABLE_ROOK_NFS` will be set to TRUE)
8. `ENABLE_ROOK_CEPH` enables the rook-ceph as a storage provider
9. `ENABLE_HOSTPATH` enables the hostpath or standard as a storage provider, useful for single-node
   clusters.
10. `ORCHEST_DEFAULT_TAG` the default container tag of `orchest-api`, `orchest-webserver`,
    `auth-server`, `node-agent` and `celery worker`, if specified, the tags of all
    mentioned components will be adjusted accordingly. default: `k8s-beta`
11. `ORCHEST_API_TAG` defines the tag of `orchest-api`, if not defined, falls back to
    `ORCHEST_DEFAULT_TAG`
12. `AUTH_SERVER_TAG` defines the tag of `auth-server`, if not defined, falls back to
    `ORCHEST_DEFAULT_TAG`
13. `CELERY_WORKER_TAG` defines the tag of `celery-worker`, if not defined, falls back to
    `ORCHEST_DEFAULT_TAG`
14. `ORCHEST_WEBSERVER_TAG` defines the tag of `orchest-webserver`, if not defined, falls back to
    `ORCHEST_DEFAULT_TAG`
15. `NODE_AGENT_TAG` defines the tag of `node-agent`, if not defined, falls back to
    `ORCHEST_DEFAULT_TAG`
16. `RABBITMQ_TAG` defines the tag of `rabbitmq`, default: `3`
17. `ROOK_NFS_IMAGE_TAGE` defines the rook-nfs docker tag, default: `v1.7.3`
18. `ROOK_CEPH_IMAGE_TAGE` defines the rook-ceph docker tag, default: `v1.8.2`
19. `ORCHEST_FQDN` defines the orchest FQDN. default: `www.localorchest.io`

The following targets are defined:

1. `orchest` to deploy orchest in the cluster
