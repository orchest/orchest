# Helm chart
# v2.3.2
* Bump app/driver version to `v1.4.5`

# v2.3.1
* Bump app/driver version to `v1.4.4`

# v2.3.0
* Bump app/driver version to `v1.4.3`

# v2.2.9
* Bump app/driver version to `v1.4.2`

# v2.2.8
* Bump app/driver version to `v1.4.1`

# v2.2.7
* Bump app/driver version to `v1.4.0`
# v2.2.6
* Bump app/driver version to `v1.3.8`

# v2.2.5
* Bump app/driver version to `v1.3.7`

# v2.2.4
* Add STS regional endpoints flag to fix PV creation on private EKS

# v2.2.3
* Bump app/driver version to `v1.3.6`

# v2.2.2
* Add controller.volMetricsOptIn for emitting volume metrics
* Update ECR sidecars to 1-18-13

# v2.2.1
* Bump app/driver version to `v1.3.5`

# v2.2.0
* Allow health ports to be configured
* Add Missing "patch" permission for "events"

# v2.1.6
* Bump app/driver version to `v1.3.4`

# v2.1.5
* Bump app/driver version to `v1.3.3`

# v2.1.4
* Add node.serviceAccount values for creating and/or specifying daemonset service account

# v2.1.3
* Bump app/driver version to `v1.3.2` 

# v2.1.2
* Add extra-create-metadata

# v2.1.1
* Update app/driver version to `v1.3.1`

# v2.1.0

## New features
* Update app/driver version to `v1.3.0`

## Bug fixes
* Put comments back in place inside the values file ([#475](https://github.com/kubernetes-sigs/aws-efs-csi-driver/pull/475), [@pierluigilenoci](https://github.com/pierluigilenoci))

# v2.0.1

## Bug fixes
* Helm chart: fix reclaimPolicy and volumeBindingMode ([#464](https://github.com/kubernetes-sigs/aws-efs-csi-driver/pull/464), [@devinsmith911](https://github.com/devinsmith911))


# v2.0.0

## Breaking changes

Multiple changes in values file at `sidecars`, `controller` and `node`

---
```yaml
sidecars:
  xxxxxxxxx:
    repository:
    tag:
```

Moving to

```yaml
sidecars:
  xxxxxxxxx:
    image:
      repository:
      tag:
```

---
```yaml
podAnnotations:
resources:
nodeSelector:
tolerations:
affinity:
```

Moving to

```yaml
controller:
  podAnnotations:
  resources:
  nodeSelector:
  tolerations:
  affinity:
```

---
```yaml
hostAliases:
dnsPolicy:
dnsConfig:
```

Moving to

```yaml
node:
  hostAliases:
  dnsPolicy:
  dnsConfig:
```

---
```yaml
serviceAccount:
  controller:
```

Moving to

```yaml
controller:
  serviceAccount:
```

## New features

* Chart API `v2` (requires Helm 3)
* Set `resources` and `imagePullPolicy` fields independently for containers
* Set `logLevel`, `affinity`, `nodeSelector`, `podAnnotations` and `tolerations` fields independently
for Controller deployment and Node daemonset
* Set `reclaimPolicy` and `volumeBindingMode` fields in storage class

## Fixes

* Fixing Controller deployment using `podAnnotations` and `tolerations` values from Node daemonset
* Let the user define the whole `tolerations` array, default to `- operator: Exists`
* Default `logLevel` lowered from `5` to `2`
* Default `imagePullPolicy` everywhere set to `IfNotPresent`
