package orchestcluster

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsCalVersion(t *testing.T) {
	tests := []struct {
		name    string
		version string
		result  bool
	}{
		{
			name:    "incorrect version",
			version: "incorrect version",
			result:  false,
		},
		{
			name:    "wrong year",
			version: "v202.02.2",
			result:  false,
		},
		{
			name:    "wrong month",
			version: "v2022.2.2",
			result:  false,
		},
		{
			name:    "wrong patch",
			version: "v2022.2.",
			result:  false,
		},
		{
			name:    "correct version",
			version: "v2022.02.2",
			result:  true,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := isCalverVersion(test.version)
			assert.Equal(t, result, test.result)
		})
	}
}

func TestParseImageName(t *testing.T) {
	tests := []struct {
		name      string
		imageName string
		domain    string
		image     string
		tag       string
	}{
		{
			name:      "Default domain with latest tag",
			imageName: "orchest-webserver:latest",
			domain:    "",
			image:     "orchest-webserver",
			tag:       "latest",
		},
		{
			name:      "Default domain without latest tag",
			imageName: "orchest-api",
			domain:    "",
			image:     "orchest-api",
			tag:       "latest",
		},
		{
			name:      "Default domain with specified tag",
			imageName: "orchest-api:v2022.08.1",
			domain:    "",
			image:     "orchest-api",
			tag:       "v2022.08.1",
		},
		{
			name:      "Custom domain with the specified tag",
			imageName: "my.test.registry/orchest-api:v2022.08.1",
			domain:    "my.test.registry",
			image:     "orchest-api",
			tag:       "v2022.08.1",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			domain, image, tag := parseImageName(test.imageName)
			assert.Equal(t, test.domain, domain)
			assert.Equal(t, test.image, image)
			assert.Equal(t, test.tag, tag)
		})
	}
}
