{{/*
Get the name of the certificate which will be used by docker-registry.
*/}}
{{- define "library.cluster.registry.certificate" -}}
  {{- if .Values.certificate -}}
    {{ .Values.certificate | trunc 63 | trimSuffix "-" }}
  {{- else -}}
    {{ "registry-certificate" }}
  {{- end }}
{{- end -}}

{{/*
Get the dns of docker-registry.
*/}}
{{- define "library.cluster.registry.dns" -}}
{{ printf "%s.%s.svc.cluster.local" .Values.name .Release.Namespace }}
{{- end -}}


{{/*
Get the dns of docker-registry.
*/}}
{{- define "library.cluster.registry.uri" -}}
{{- printf "spiffe://cluster.local/ns/%s/sa/%s" .Release.Namespace  .Values.name  -}}
{{- end -}}
