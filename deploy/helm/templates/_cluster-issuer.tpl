{{/*
Get the name of cluster issuer resources
*/}}
{{- define "library.cluster.issuer.name" -}}
  {{- if .Values.issuer.name -}}
    {{ .Values.issuer.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "registry-issuer" }}
  {{- end }}
{{- end -}}