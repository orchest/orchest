{{/*
Get the name of the certificate which will be used by docker-registry.
*/}}
{{- define "library.cluster.registry.certificate" -}}
{{- .Values.registryCertificate | default "registry-certificate" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Get the dns of docker-registry.
*/}}
{{- define "library.cluster.registry.dns" -}}
{{ printf "%s.%s.svc.cluster.local" .Values.registry.name .Release.Namespace }}
{{- end -}}


{{/*
Get the dns of docker-registry.
*/}}
{{- define "library.cluster.registry.uri" -}}
{{ printf "spiffe://cluster.local/ns/%s/sa/%s" .Release.Namespace  .Values.registry.name  }}
{{- end -}}
