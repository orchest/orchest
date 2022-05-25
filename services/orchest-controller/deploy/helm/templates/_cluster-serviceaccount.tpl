{{/*
*/}}
{{- define "library.cluster.serviceaccounts" }}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ template "library.metadata.name" . }}
  namespace: {{.Release.Namespace}}
{{ end }}
