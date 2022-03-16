{{/*
Get the name of the CephFileSystem.
*/}}
{{- define "library.cluster.ceph.filesystem.name" -}}
  {{- if .Values.cephFileSystems.name -}}
    {{ .Values.cephFileSystems.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "ceph-filesystem" }}
  {{- end }}
{{- end -}}

{{/*
Get the name of the StorageClass for CephFileSystem.
*/}}
{{- define "library.cluster.ceph.filesystem.storageclass" -}}
  {{- if .Values.cephFileSystems.storageClass.name -}}
    {{ .Values.cephFileSystems.storageClass.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "ceph-filesystem" }}
  {{- end }}
{{- end -}}