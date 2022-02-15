{{/*
Create base deployment settings
*/}}
{{- define "library.deployment" }}
apiVersion: apps/v1
kind: Deployment
metadata:
  {{- include "library.metadata" . | nindent 4 }}
spec:
  replicas: {{ template "library.spec.replicas" . }}
  strategy:
    type: Recreate
  selector:
    matchLabels:
      {{- include "library.labels.selector" . | nindent 8 }}
  template:
    metadata:
      labels:
        {{- include "library.labels.selector" . | nindent 8 }}
{{- end }}