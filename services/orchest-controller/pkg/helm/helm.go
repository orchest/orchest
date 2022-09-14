package helm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"

	"github.com/pkg/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/klog/v2"
)

type Json map[string]interface{}

func GetReleaseConfig(ctx context.Context, name, namespace string) (string, error) {

	klog.V(2).Infof("Attempting to get the manifests of release: %s, namespace: %s", name, namespace)

	args := NewHelmArgBuilder().
		WithGetManifest().
		WithName(name).
		WithNamespace(namespace).
		Build()

	cmd := exec.CommandContext(ctx, "helm", args...)

	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	err := cmd.Run()
	_, ok := err.(*exec.ExitError)
	if ok {
		return "", errors.Wrapf(err, "failed to get the helm deployment release: %s, namespace: %s", name, namespace)
	}

	return stdout.String(), nil
}

func RemoveHelmHistoryIfNeeded(ctx context.Context,
	client kubernetes.Interface,
	name, namespace string) error {

	klog.V(2).Infof("Attempting to get the state of release: %s, namespace: %s", name, namespace)
	args := NewHelmArgBuilder().
		WithStatus().
		WithName(name).
		WithNamespace(namespace).
		WithJsonOutput().
		Build()

	status, err := RunCommand(ctx, args)
	if err != nil {
		return err
	}

	var statusJson Json

	err = json.Unmarshal([]byte(status), &statusJson)
	if err != nil {
		return err
	}

	if getStatusFromStatusJson(statusJson) != "pending-rollback" {
		return nil
	}

	// Rollingback most probably won't work and results in a
	// Helm: Error: has no deployed releases, since there is no
	// helm version with deployed status, we remove the helm secrets
	// to be able to create the release again.

	klog.V(2).Infof("Attempting to remove the helm secrets for release: %s, namespace: %s", name, namespace)

	secrets, err := client.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return err
	}

	for _, secret := range secrets.Items {
		if secret.Type == "helm.sh/release.v1" && secret.Labels["name"] == name {
			err = client.CoreV1().Secrets(namespace).Delete(ctx, secret.Name, metav1.DeleteOptions{})
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func GetTemplate(ctx context.Context, name, namespace string) ([]byte, error) {

	klog.V(2).Infof("Attempting to render the templates of release: %s, namespace: %s", name, namespace)

	args := NewHelmArgBuilder().
		WithTemplate().
		WithName(name).
		WithNamespace(namespace).
		Build()

	cmd := exec.CommandContext(ctx, "helm", args...)

	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	err := cmd.Run()
	_, ok := err.(*exec.ExitError)
	if ok {
		return nil, errors.Wrapf(err, "failed to render the templates of release: %s, namespace: %s", name, namespace)
	}

	return stdout.Bytes(), nil
}

func RunCommand(ctx context.Context, args []string) (string, error) {

	cmd := exec.CommandContext(ctx, "helm", args...)

	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	err := cmd.Run()
	_, ok := err.(*exec.ExitError)
	if ok {
		return "", fmt.Errorf("failed to deploy helm deployment %s", stderr.String())
	}

	return stdout.String(), err
}

func RemoveRelease(ctx context.Context, name, namespace string) error {

	klog.V(2).Infof("Attempting to remove the release: %s, namespace: %s", name, namespace)

	args := NewHelmArgBuilder().
		WithUnInstall().
		WithName(name).
		WithNamespace(namespace).
		Build()

	cmd := exec.CommandContext(ctx, "helm", args...)

	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	err := cmd.Run()
	_, ok := err.(*exec.ExitError)
	if ok {
		return errors.Wrapf(err, "failed to remove helm deployment release: %s, namespace: %s", name, namespace)
	}

	return nil
}

func getStatusFromStatusJson(statusJson map[string]interface{}) string {
	if statusJson["info"] != nil {
		info := statusJson["info"].(map[string]interface{})
		if info != nil {
			if info["status"] != nil {
				return info["status"].(string)
			}
		}
	}
	return ""
}
