{{/*
Get the default port, this method might be overwritten but subcharts
*/}}
{{- define "library.container.port" -}}
{{ .Values.port | default 80 }}
{{- end -}}

{{/*
Generate service
*/}}
{{- define "library.service" }}
apiVersion: v1
kind: Service
metadata:
  {{- include "library.metadata" . | nindent 4 }}
spec:
  ports:
  - port: {{ template "library.container.port" . }}
    protocol: TCP
  selector:
    {{- include "library.labels.selector" . | nindent 4 }}
{{- end }}