package helm

import (
	"bytes"
	"context"
	"encoding/json"
	"os/exec"
	"reflect"

	"github.com/pkg/errors"
	"k8s.io/klog/v2"
)

type Values map[string]interface{}

func StructToValues(valuesStruct interface{}) Values {

	values := Values{}
	if valuesStruct == nil {
		return values
	}
	v := reflect.TypeOf(valuesStruct)
	reflectValue := reflect.ValueOf(valuesStruct)
	reflectValue = reflect.Indirect(reflectValue)

	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	for i := 0; i < v.NumField(); i++ {
		tag := v.Field(i).Tag.Get("helm")
		field := reflectValue.Field(i).Interface()
		if tag != "" && tag != "-" {
			if v.Field(i).Type.Kind() == reflect.Struct {
				values[tag] = StructToValues(field)
			} else {
				values[tag] = field
			}
		}
	}
	return values
}

func GetReleaseConfig(ctx context.Context, name, namespace string) (Values, error) {

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
