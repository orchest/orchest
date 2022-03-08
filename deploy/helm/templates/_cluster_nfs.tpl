{{/*
Get the name of the NFS Server.
*/}}
{{- define "library.cluster.nfs.name" -}}
  {{- if .Values.nfs.name -}}
    {{ .Values.nfs.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "rook-nfs" }}
  {{- end }}
{{- end -}}


{{/*
Get the name of the NFS Server.
*/}}
{{- define "library.cluster.nfs.claim.name" -}}
  {{- if .Values.nfs.claim.name -}}
    {{ .Values.nfs.claim.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "rook-nfs-claim" }}
  {{- end }}
{{- end -}}

{{/*
Get the name of the NFS storage class.
*/}}
{{- define "library.cluster.nfs.storageClass.name" -}}
  {{- if .Values.nfs.storageClass.name -}}
    {{ .Values.nfs.storageClass.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "rook-nfs-share" }}
  {{- end }}
{{- end -}}

{{/*
Get the name of the NFS pvc storage class.
*/}}
{{- define "library.cluster.nfs.claim.storageClassName" -}}
  {{- if .Values.nfs.claim.storageClassName -}}
    {{ .Values.nfs.claim.storageClassName | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "standard" }}
  {{- end }}
{{- end -}}