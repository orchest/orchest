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
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1" // nolint:gosec
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"time"
)

const (
	// DefaultContourServiceName holds the default service name
	// used for the Contour Kubernetes service. This value is added
	// to the Contour certificate's Subject Alt Names.
	DefaultRegistryServiceName = "docker-registry"

	// DefaultCertificateLifetime holds the default certificate lifetime
	// (in days).
	DefaultCertificateLifetime = 365

	// DefaultNamespace where Contour is deployed. This value is added
	// to the certificates Subject Alt Names.
	DefaultNamespace = "orchest"

	// DefaultDNSName holds the Kubernetes local dns suffix name
	// specific to the cluster where Contour is deployed and is used when
	// configuring Subject Alt Names on the certificates.
	DefaultDNSName = "cluster.local"

	// keySize sets the RSA key size to 2048 bits. This is minimum recommended size
	// for RSA keys.
	keySize = 2048
)

// Configuration holds config parameters used for generating certificates.
type Configuration struct {

	// Lifetime is the number of days for which certificates will be valid.
	Lifetime uint

	// Namespace is the Kubernetes namespace name to add to the generated
	// certificates Subject Alternate Name values.
	Namespace string

	// DNSName holds the Kubernetes local dns suffix name
	// specific to the cluster where Contour is deployed and is used when
	// configuring Subject Alt Names on the certificates.
	DNSName string

	// IP address of the certificate
	IP string

	// ContourServiceName holds the name of the docker-registry service name.
	RegistryServiceName string
}

// Certificates contains a set of Certificates as []byte each holding
// the CA Cert along with with Docker-Registry Certs.
type Certificates struct {
	CACertificate       []byte
	RegistryCertificate []byte
	RegistryPrivateKey  []byte
}

// GenerateCerts generates a CA Certificate along with certificates for
// Contour & Envoy returning them as a *Certificates struct or error if encountered.
func GenerateCerts(config *Configuration) (*Certificates, error) {

	// Check if the config is not passed, then default.
	if config == nil {
		config = &Configuration{}
	}

	now := time.Now()
	expiry := now.Add(24 * time.Duration(uint32OrDefault(config.Lifetime, DefaultCertificateLifetime)) * time.Hour)
	caCertPEM, caKeyPEM, err := newCA("orchest", expiry)
	if err != nil {
		return nil, err
	}

	registryCert, registryKey, err := newCert(caCertPEM,
		caKeyPEM,
		expiry,
		config.IP,
		stringOrDefault(config.RegistryServiceName, DefaultRegistryServiceName),
		stringOrDefault(config.Namespace, DefaultNamespace),
		stringOrDefault(config.DNSName, DefaultDNSName),
	)
	if err != nil {
		return nil, err
	}

	return &Certificates{
		CACertificate:       caCertPEM,
		RegistryCertificate: registryCert,
		RegistryPrivateKey:  registryKey,
	}, nil
}

// newCert generates a new keypair given the CA keypair, the expiry time, the service name
// ("contour" or "envoy"), and the Kubernetes namespace the service will run in (because
// of the Kubernetes DNS schema.)
// The return values are cert, key, err.
func newCert(caCertPEM, caKeyPEM []byte, expiry time.Time, IP, service, namespace, dnsname string) ([]byte, []byte, error) {

	caKeyPair, err := tls.X509KeyPair(caCertPEM, caKeyPEM)
	if err != nil {
		return nil, nil, err
	}
	caCert, err := x509.ParseCertificate(caKeyPair.Certificate[0])
	if err != nil {
		return nil, nil, err
	}
	caKey, ok := caKeyPair.PrivateKey.(*rsa.PrivateKey)
	if !ok {
		return nil, nil, fmt.Errorf("CA private key has unexpected type %T", caKeyPair.PrivateKey)
	}

	newKey, err := rsa.GenerateKey(rand.Reader, keySize)
	if err != nil {
		return nil, nil, fmt.Errorf("cannot generate key: %v", err)
	}

	now := time.Now()
	template := &x509.Certificate{
		SerialNumber: newSerial(now),
		Subject: pkix.Name{
			CommonName: service,
		},
		NotBefore:    now.UTC().AddDate(0, 0, -1),
		NotAfter:     expiry.UTC(),
		SubjectKeyId: bigIntHash(newKey.N),
		IPAddresses:  []net.IP{net.ParseIP(IP)},
		KeyUsage: x509.KeyUsageDigitalSignature |
			x509.KeyUsageDataEncipherment |
			x509.KeyUsageKeyEncipherment |
			x509.KeyUsageContentCommitment,
		DNSNames: serviceNames(IP, service, namespace, dnsname),
	}
	newCert, err := x509.CreateCertificate(rand.Reader, template, caCert, &newKey.PublicKey, caKey)
	if err != nil {
		return nil, nil, err
	}

	newKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(newKey),
	})
	newCertPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: newCert,
	})
	return newCertPEM, newKeyPEM, nil

}

// newCA generates a new CA, given the CA's CN and an expiry time.
// The return order is cacert, cakey, error.
func newCA(cn string, expiry time.Time) ([]byte, []byte, error) {

	key, err := rsa.GenerateKey(rand.Reader, keySize)
	if err != nil {
		return nil, nil, err
	}

	now := time.Now()
	serial := newSerial(now)
	template := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName:   cn,
			SerialNumber: serial.String(),
		},
		NotBefore:             now.UTC().AddDate(0, 0, -1),
		NotAfter:              expiry.UTC(),
		SubjectKeyId:          bigIntHash(key.N),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		IsCA:                  true,
		BasicConstraintsValid: true,
	}
	certDER, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		return nil, nil, err
	}
	certPEMData := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: certDER,
	})
	keyPEMData := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})
	return certPEMData, keyPEMData, nil
}

func newSerial(now time.Time) *big.Int {
	return big.NewInt(int64(now.Nanosecond()))
}

// bigIntHash generates a SubjectKeyId by hashing the modulus of the private
// key. This isn't one of the methods listed in RFC 5280 4.2.1.2, but that also
// notes that other methods are acceptable.
//
// gosec makes a blanket claim that SHA-1 is unacceptable, which is
// false here. The core Go method of generations the SubjectKeyId (see
// https://github.com/golang/go/issues/26676) also uses SHA-1, as recommended
// by RFC 5280.
func bigIntHash(n *big.Int) []byte {
	h := sha1.New()    // nolint:gosec
	h.Write(n.Bytes()) // nolint:errcheck
	return h.Sum(nil)
}

func serviceNames(IP, service, namespace, dnsname string) []string {
	return []string{
		IP,
		service,
		fmt.Sprintf("%s.%s", service, namespace),
		fmt.Sprintf("%s.%s.svc", service, namespace),
		fmt.Sprintf("%s.%s.svc.%s", service, namespace, dnsname),
	}
}

func stringOrDefault(val string, defaultval string) string {
	if len(val) > 0 {
		return val
	}
	return defaultval
}

func uint32OrDefault(val uint, defaultval uint) uint {
	if val != 0 {
		return val
	}
	return defaultval
}
