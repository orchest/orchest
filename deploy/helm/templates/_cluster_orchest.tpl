{{/*
Get the name of the userdir pvc.
*/}}
{{- define "library.cluster.orchest.userdir.name" -}}
  {{- if .Values.userdir.name -}}
    {{ .Values.userdir.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "userdir-pvc" }}
  {{- end }}
{{- end -}}

{{/*
Get the name of the kaniko pvc.
*/}}
{{- define "library.cluster.orchest.kanikocache.name" -}}
  {{- if .Values.kanikocache.name -}}
    {{ .Values.kanikocache.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "kaniko-cache-pvc" }}
  {{- end }}
{{- end -}}

{{/*
Get the name of the userdir pvc.
*/}}
{{- define "library.cluster.orchest.config.name" -}}
  {{- if .Values.config.name -}}
    {{ .Values.config.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "config-pvc" }}
  {{- end }}
{{- end -}}

{{/*
Get the name of the filesystem storage class.
*/}}
{{- define "library.cluster.orchest.filesystem.storageClass" -}}
  {{- if .Values.filesystem.storageClass -}}
    {{ .Values.filesystem.storageClass | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "standard" }}
  {{- end }}
{{- end -}}