package helm

import (
	"fmt"
	"strconv"
	"time"
)

type HelmArgBuilder struct {
	command []string
	args    []string
}

func NewHelmArgBuilder() *HelmArgBuilder {

	// Creating args with capacity of 10, if more is needed, it will be explanded
	return &HelmArgBuilder{
		args: make([]string, 0, 10),
	}
}

func (builder *HelmArgBuilder) WithUpgradeInstall() *HelmArgBuilder {
	builder.command = []string{"upgrade", "--install"}
	return builder
}

func (builder *HelmArgBuilder) WithUnInstall() *HelmArgBuilder {
	builder.command = []string{"uninstall"}
	return builder
}

func (builder *HelmArgBuilder) WithRollback() *HelmArgBuilder {
	builder.command = []string{"rollback"}
	return builder
}

func (builder *HelmArgBuilder) WithTemplate() *HelmArgBuilder {
	builder.command = []string{"template", "--debug"}
	return builder
}

func (builder *HelmArgBuilder) WithGetManifest() *HelmArgBuilder {
	builder.command = []string{"get", "manifest"}
	return builder
}

func (builder *HelmArgBuilder) WithStatus() *HelmArgBuilder {
	builder.command = []string{"status"}
	return builder
}

func (builder *HelmArgBuilder) WithJsonOutput() *HelmArgBuilder {
	builder.args = append(builder.args, "--output", "json")
	return builder
}

func (builder *HelmArgBuilder) WithWait() *HelmArgBuilder {
	builder.args = append(builder.args, "--wait")
	return builder
}

func (builder *HelmArgBuilder) WithAtomic() *HelmArgBuilder {
	builder.args = append(builder.args, "--atomic")
	return builder
}

func (builder *HelmArgBuilder) WithValuesFile(values string) *HelmArgBuilder {
	builder.args = append(builder.args, "-f", values)
	return builder
}

func (builder *HelmArgBuilder) WithName(name string) *HelmArgBuilder {
	builder.args = append(builder.args, name)
	return builder
}

func (builder *HelmArgBuilder) WithNamespace(namespace string) *HelmArgBuilder {
	builder.args = append(builder.args, "--namespace", namespace)
	return builder
}

func (builder *HelmArgBuilder) WithCreateNamespace() *HelmArgBuilder {
	builder.args = append(builder.args, "--create-namespace")
	return builder
}

func (builder *HelmArgBuilder) WithVersion(version int) *HelmArgBuilder {
	builder.args = append(builder.args, strconv.Itoa(version))
	return builder
}

func (builder *HelmArgBuilder) WithTimeout(duration time.Duration) *HelmArgBuilder {
	builder.args = append(builder.args, "--timeout", duration.String())
	return builder
}

func (builder *HelmArgBuilder) WithSetValue(key, value string) *HelmArgBuilder {
	builder.args = append(builder.args, "--set", fmt.Sprintf("%s=%s", key, value))
	return builder
}

func (builder *HelmArgBuilder) WithRepository(repo string) *HelmArgBuilder {
	builder.args = append(builder.args, repo)
	return builder
}

func (builder *HelmArgBuilder) Build() []string {
	return append(builder.command, builder.args...)
}
