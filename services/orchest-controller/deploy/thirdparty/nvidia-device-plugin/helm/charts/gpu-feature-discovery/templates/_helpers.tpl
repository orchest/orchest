{{/*
Allow the release namespace to be overridden for multi-namespace deployments in combined charts
*/}}
{{- define "gpu-feature-discovery.namespace" -}}
  {{- if .Values.namespaceOverride -}}
    {{- .Values.namespaceOverride -}}
  {{- else -}}
    {{- .Release.Namespace -}}
  {{- end -}}
{{- end -}}