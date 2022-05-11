// Copyright Project Contour Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package certs

import (
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateCerts(t *testing.T) {
	type testcase struct {
		config             *Configuration
		wantContourDNSName string
		wantEnvoyDNSName   string
		wantError          error
	}

	run := func(t *testing.T, name string, tc testcase) {
		t.Helper()

		t.Run(name, func(t *testing.T) {
			t.Helper()

			got, err := GenerateCerts(tc.config)

			// Note we don't match error string values
			// because the actual values come from Kubernetes
			// internals and may not be stable.
			if tc.wantError == nil && err != nil {
				t.Errorf("wanted no error, got error %q", err)
			}

			// If using a custom lifetime, validate the certs
			// as of an hour before the intended expiration.
			currentTime := time.Now()
			if tc.config.Lifetime != 0 {
				currentTime = currentTime.Add(24 * time.Hour * time.Duration(tc.config.Lifetime)).Add(-time.Hour)
			}

			roots := x509.NewCertPool()
			ok := roots.AppendCertsFromPEM(got.CACertificate)
			require.Truef(t, ok, "Failed to set up CA cert for testing, maybe it's an invalid PEM")

			err = verifyCert(got.ContourCertificate, roots, tc.wantContourDNSName, currentTime)
			assert.NoErrorf(t, err, "Validating %s failed", name)

			err = verifyCert(got.EnvoyCertificate, roots, tc.wantEnvoyDNSName, currentTime)
			assert.NoErrorf(t, err, "Validating %s failed", name)
		})
	}

	run(t, "no configuration - use defaults", testcase{
		config:             &Configuration{},
		wantContourDNSName: "contour",
		wantEnvoyDNSName:   "envoy",
		wantError:          nil,
	})

	run(t, "custom service names", testcase{
		config: &Configuration{
			ContourServiceName: "customcontour",
			EnvoyServiceName:   "customenvoy",
		},
		wantContourDNSName: "customcontour",
		wantEnvoyDNSName:   "customenvoy",
		wantError:          nil,
	})

	run(t, "custom namespace", testcase{
		config: &Configuration{
			Namespace: "customnamespace",
		},
		wantContourDNSName: "contour",
		wantEnvoyDNSName:   "envoy",
		wantError:          nil,
	})

	run(t, "custom lifetime", testcase{
		config: &Configuration{
			// use a lifetime longer than the default so we
			// can verify that it's taking effect by validating
			// the certs as of a time after the default expiration.
			Lifetime: DefaultCertificateLifetime * 2,
		},
		wantContourDNSName: "contour",
		wantEnvoyDNSName:   "envoy",
		wantError:          nil,
	})

	run(t, "custom dns name", testcase{
		config: &Configuration{
			DNSName: "project.contour",
		},
		wantContourDNSName: "contour",
		wantEnvoyDNSName:   "envoy",
		wantError:          nil,
	})
}

func TestGeneratedCertsValid(t *testing.T) {

	now := time.Now()
	expiry := now.Add(24 * 365 * time.Hour)

	cacert, cakey, err := newCA("contour", expiry)
	require.NoErrorf(t, err, "Failed to generate CA cert")

	contourcert, _, err := newCert(cacert, cakey, expiry, "contour", "projectcontour", "cluster.local")
	require.NoErrorf(t, err, "Failed to generate Contour cert")

	roots := x509.NewCertPool()
	ok := roots.AppendCertsFromPEM(cacert)
	require.Truef(t, ok, "Failed to set up CA cert for testing, maybe it's an invalid PEM")

	envoycert, _, err := newCert(cacert, cakey, expiry, "envoy", "projectcontour", "cluster.local")
	require.NoErrorf(t, err, "Failed to generate Envoy cert")

	tests := map[string]struct {
		cert    []byte
		dnsname string
	}{
		"contour cert": {
			cert:    contourcert,
			dnsname: "contour",
		},
		"envoy cert": {
			cert:    envoycert,
			dnsname: "envoy",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			err := verifyCert(tc.cert, roots, tc.dnsname, now)
			assert.NoErrorf(t, err, "Validating %s failed", name)
		})
	}

}

func verifyCert(certPEM []byte, roots *x509.CertPool, dnsname string, currentTime time.Time) error {
	block, _ := pem.Decode(certPEM)
	if block == nil {
		return fmt.Errorf("Failed to decode %s certificate from PEM form", dnsname)
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return err
	}

	opts := x509.VerifyOptions{
		DNSName:     dnsname,
		Roots:       roots,
		CurrentTime: currentTime,
	}
	if _, err = cert.Verify(opts); err != nil {
		return fmt.Errorf("Certificate verification failed: %s", err)
	}

	return nil
}
