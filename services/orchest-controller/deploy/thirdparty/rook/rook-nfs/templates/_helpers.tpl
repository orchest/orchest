{{/*
Common labels
*/}}
{{- define "library.rook-nfs.labels" -}}
app.kubernetes.io/part-of: rook-nfs-operator
app.kubernetes.io/managed-by: helm
app.kubernetes.io/created-by: helm
helm.sh/chart: "{{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}"
{{- end -}}