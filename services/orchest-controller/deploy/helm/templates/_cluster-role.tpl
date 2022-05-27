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
      - "*"
    resources:
      - "*"
    verbs:
      - "*"
{{- end -}}
