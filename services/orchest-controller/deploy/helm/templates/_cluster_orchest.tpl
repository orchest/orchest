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
Get the name of the image builder pvc.
*/}}
{{- define "library.cluster.orchest.imagebuildercache.name" -}}
  {{- if .Values.imagebuildercache.name -}}
    {{ .Values.imagebuildercache.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "image-builder-cache-pvc" }}
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