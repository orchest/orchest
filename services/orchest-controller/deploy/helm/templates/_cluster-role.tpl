{{/*
*/}}
{{- define "library.cluster.roles" -}}
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: {{ template "library.metadata.name" . }}
  labels:
    {{- include "library.labels.selector" . | nindent 4 }}
rules:
  - apiGroups: 
      - ""
      - "argoproj.io"
      - "apps"
      - "networking.k8s.io"
      - "rbac.authorization.k8s.io"
    resources:
      - workflows
      - deployments
      - deployments/scale
      - deployments/status
      - services
      - services/status
      - ingresses
      - ingresses/status
      - namespaces
      - namespaces/status
      - pods
      - pods/log
      - pods/attach
      - roles
      - serviceaccounts
      - rolebindings
    verbs:
      - create
      - get
      - list
      - watch
      - update
      - delete
      - patch
{{- end -}}
