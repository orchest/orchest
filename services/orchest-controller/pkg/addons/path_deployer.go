package addons

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/pkg/errors"
	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type PathDeployer struct {
	name    string
	objects []client.Object
	gClient client.Client
}

func NewPathDeployer(name, root string, gClient client.Client, scheme *runtime.Scheme) Addon {

	files := make([]*os.File, 0, 0)

	err := filepath.Walk(root, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if fi.IsDir() {
			if path != root {
				return filepath.SkipDir
			}
			return nil
		}

		file, err := os.Open(path)
		if err != nil {
			return errors.Wrapf(err, "failed to open file %s", path)
		}

		files = append(files, file)
		return nil
	})

	if err != nil {
		klog.Fatalf("failed to create PathDeployer, err: %v", err)
	}

	objects := make([]client.Object, 0)
	codecFactory := serializer.NewCodecFactory(scheme)
	decoder := codecFactory.UniversalDecoder(scheme.PrioritizedVersionsAllGroups()...)

	for _, file := range files {
		utf16bom := unicode.BOMOverride(unicode.UTF8.NewDecoder())
		reader := transform.NewReader(file, utf16bom)

		d := yaml.NewYAMLOrJSONDecoder(reader, 4096)
		for {
			ext := runtime.RawExtension{}
			if err := d.Decode(&ext); err != nil {
				if err == io.EOF {
					break
				}
				klog.V(3).Infof("error parsing %v", err)
				continue
			}

			ext.Raw = bytes.TrimSpace(ext.Raw)
			if len(ext.Raw) == 0 || bytes.Equal(ext.Raw, []byte("null")) {
				continue
			}

			obj, _, err := decoder.Decode(ext.Raw, nil, nil)
			if err != nil {
				klog.V(3).Infof("unable to decode %v", err)
				continue
			}

			object := obj.(client.Object)
			if object == nil {
				klog.V(3).Infof("failed to cast to client.Object", obj)
				continue
			}

			objects = append(objects, object)

		}

	}

	if len(objects) == 0 {
		klog.Fatalf("failed to retrive kubernetes resources from path %s", root)
	}

	return &PathDeployer{
		name:    name,
		objects: objects,
		gClient: gClient,
		//path: path,
	}
}

// Installs deployer if the config is changed
func (d *PathDeployer) Enable(ctx context.Context, preInstall []PreInstallHookFn,
	namespace string, _ *orchestv1alpha1.ApplicationSpec) error {

	for _, obj := range d.objects {
		err := d.gClient.Create(ctx, obj, &client.CreateOptions{})
		if err != nil && !kerrors.IsAlreadyExists(err) {
			return err
		}
	}
	return nil
}

// Uninstall the addon
func (d *PathDeployer) Uninstall(ctx context.Context, namespace string) error {
	for _, obj := range d.objects {
		err := d.gClient.Delete(ctx, obj, &client.DeleteOptions{})
		if err != nil {
			return err
		}
	}
	return nil
}
