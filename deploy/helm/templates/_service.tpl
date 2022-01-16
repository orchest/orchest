{{/*
Get the port, this method might be overwritten but subcharts
*/}}
{{- define "library.service.port" -}}
{{ .Values.port | default 80 }}
{{- end -}}

{{/*
Get the service type
*/}}
{{- define "library.service.type" -}}
{{ .Values.service.type | default "ClusterIP" }}
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
  type: {{ template "library.service.type" . }}
  ports:
  - port: {{ template "library.service.port" . }}
    protocol: TCP
  selector:
    {{- include "library.labels.selector" . | nindent 4 }}
{{- end }}