package helm

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"

	"github.com/pkg/errors"
	"k8s.io/klog/v2"
)

func GetReleaseConfig(ctx context.Context, name, namespace string) (string, error) {

	klog.V(2).Infof("Attempting to get the status of release: %s, namespace: %s", name, namespace)

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
		WithJsonOutput().Build()

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
