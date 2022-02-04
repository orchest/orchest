{{/*
Get the name of the CephBlockPool.
*/}}
{{- define "library.cluster.ceph.blockpool.name" -}}
  {{- if .Values.cephBlockPools.name -}}
    {{ .Values.cephBlockPools.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "ceph-blockpool" }}
  {{- end }}
{{- end -}}

{{/*
Get the name of the StorageClass for CephBlockPool.
*/}}
{{- define "library.cluster.ceph.blockpool.storageclass" -}}
  {{- if .Values.cephBlockPools.storageClass.name -}}
    {{ .Values.cephBlockPools.storageClass.name | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "ceph-block" }}
  {{- end }}
{{- end -}}