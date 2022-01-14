{{/*
*/}}
{{- define "library.service" }}
apiVersion: v1
kind: Service
metadata:
  {{- include "library.metadata" . | nindent 4 }}
spec:
  ports:
  - port: 80
    protocol: TCP
  selector:
    {{- include "library.labels.selector" . | nindent 4 }}
{{- end }}