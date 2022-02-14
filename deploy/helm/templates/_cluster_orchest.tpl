{{/*
Get the name of the userdir pvc.
*/}}
{{- define "library.cluster.orchest.userdir.name" -}}
  {{- if .Values.userdir.name -}}
    {{ .Values.userdir.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "user-dir" }}
  {{- end }}
{{- end -}}

{{/*
Get the name of the storage class for userdir.
*/}}
{{- define "library.cluster.orchest.userdir.storageClass" -}}
  {{- if .Values.userdir.storageClass -}}
    {{ .Values.userdir.storageClass | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "standard" }}
  {{- end }}
{{- end -}}