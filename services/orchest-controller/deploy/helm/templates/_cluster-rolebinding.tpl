{{/*
*/}}
{{- define "library.cluster.rolebindings" }}
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: {{ template "library.metadata.name" . }}
subjects:
  - kind: ServiceAccount
    name: {{ template "library.metadata.name" . }}
    namespace: {{.Release.Namespace}}
roleRef:
  kind: ClusterRole
  name: {{ template "library.metadata.name" . }}
  apiGroup: rbac.authorization.k8s.io
{{- end -}}
