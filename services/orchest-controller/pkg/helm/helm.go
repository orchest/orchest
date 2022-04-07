package helm

import (
	"bytes"
	"context"
	"encoding/json"
	"os/exec"

	"github.com/pkg/errors"
	"k8s.io/klog/v2"
)

type Json map[string]interface{}

func GetReleaseConfig(ctx context.Context, name, namespace string) (Json, error) {

	klog.V(2).Infof("Attempting to get the status of release: %s, namespace: %s", name, namespace)

	args := NewHelmArgBuilder().
		WithStatus().
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
		return nil, errors.Wrapf(err, "failed to get the helm deployment release: %s, namespace: %s", name, namespace)
	}

	var result map[string]interface{}

	err = json.Unmarshal(stdout.Bytes(), &result)
	if err != nil {
		return nil, errors.Wrapf(err, "failed unmarshal the helm release: %s, namespace: %s", name, namespace)
	}

	return result, nil
}

func DeployRelease(ctx context.Context, args []string) error {

	cmd := exec.CommandContext(ctx, "helm", args...)

	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	err := cmd.Run()
	_, ok := err.(*exec.ExitError)
	if ok {
		return errors.Wrap(err, "failed to deploy helm deployment")
	}

	return err
}
