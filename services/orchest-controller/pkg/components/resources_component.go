package components

import (
	"context"
	"fmt"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	registry "github.com/orchest/orchest/services/orchest-controller/pkg/componentregistry"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/pkg/errors"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/klog/v2"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

var (
	OrchestClusterKind = orchestv1alpha1.SchemeGroupVersion.WithKind("OrchestCluster")
)

type ResourcesComponent struct {
	name    string
	client  kubernetes.Interface
	gClient client.Client
}

func newResourcesComponent(name string, client kubernetes.Interface, gClient client.Client) registry.Component {
	return &ResourcesComponent{
		name:    name,
		client:  client,
		gClient: gClient,
	}
}

func (c *ResourcesComponent) Update(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {

	var err error

	defer func() {
		if err != nil {
			eventChan <- registry.ErrorEvent(err.Error())
		} else {
			eventChan <- registry.SuccessEvent{}
		}
	}()

	orchest, ok := message.(*orchestv1alpha1.OrchestCluster)
	if !ok {
		err = fmt.Errorf("Component %s requires message of type *orchestv1alpha1.OrchestCluster", c.name)
		return
	}

	generation := fmt.Sprint(orchest.Generation)

	err = c.ensurePvc(ctx, generation, controller.UserDirName,
		*orchest.Spec.Orchest.Resources.UserDirVolume, orchest)
	if err != nil {
		return
	}

	err = c.ensurePvc(ctx, generation, controller.StateVolumeName,
		*orchest.Spec.Orchest.Resources.OrchestStateVolume, orchest)
	if err != nil {
		return
	}

	err = c.ensureRbacs(ctx, generation, orchest)
	if err != nil {
		return
	}

	klog.V(4).Infof("Deleting deprecated PVC %s", controller.OldBuilderDirName)
	err = c.deletePvc(ctx, controller.OldBuilderDirName, orchest)
}

func (c *ResourcesComponent) Delete(ctx context.Context, namespace string,
	message registry.Message, eventChan chan registry.Event) {
}

func (c *ResourcesComponent) ensurePvc(ctx context.Context, curHash, name string,
	volume orchestv1alpha1.Volume, orchest *orchestv1alpha1.OrchestCluster) error {

	// Retrive the created pvcs
	oldPvc, err := c.client.CoreV1().PersistentVolumeClaims(orchest.Namespace).Get(ctx, name, metav1.GetOptions{})
	newPvc := getPersistentVolumeClaim(name, curHash, volume, orchest)
	// userdir is not created or is removed, we have to recreate it
	if err != nil && kerrors.IsNotFound(err) {
		_, err := c.client.CoreV1().PersistentVolumeClaims(orchest.Namespace).Create(ctx, newPvc, metav1.CreateOptions{})
		if err != nil {
			return errors.Wrapf(err, "failed to create %s pvc", name)
		}
		return nil
	} else if err != nil {
		return err
	}

	return c.adoptPVC(ctx, oldPvc, newPvc)

}

func (c *ResourcesComponent) deletePvc(ctx context.Context, name string, orchest *orchestv1alpha1.OrchestCluster) error {

	err := c.client.CoreV1().PersistentVolumeClaims(orchest.Namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.Infof("PVC %s not found, nothing to delete.", name)
			return nil
		}
		klog.Errorf("Failed to delete PVC %s.", name)
		return err
	}
	return nil
}

func (c *ResourcesComponent) adoptPVC(ctx context.Context, oldPvc, newPvc *corev1.PersistentVolumeClaim) error {

	_, err := c.client.CoreV1().PersistentVolumeClaims(oldPvc.Namespace).Update(ctx, oldPvc, metav1.UpdateOptions{})
	return err
}

func (c *ResourcesComponent) ensureRbacs(ctx context.Context, hash string, orchest *orchestv1alpha1.OrchestCluster) error {

	objects := make([]client.Object, 0, 6)
	apiMetadata := controller.GetMetadata(controller.OrchestApi, hash, orchest, OrchestClusterKind)
	// Get the rbac manifest
	objects = append(objects, controller.GetRbacManifest(apiMetadata)...)

	celeryMetadata := controller.GetMetadata(controller.CeleryWorker, hash, orchest, OrchestClusterKind)
	objects = append(objects, controller.GetRbacManifest(celeryMetadata)...)

	for _, obj := range objects {
		err := controller.UpsertObject(ctx, c.gClient, obj)
		if err != nil {
			return err
		}
	}

	return nil
}

func getPersistentVolumeClaim(name, hash string, volume orchestv1alpha1.Volume,
	orchest *orchestv1alpha1.OrchestCluster) *corev1.PersistentVolumeClaim {

	metadata := controller.GetMetadata(name, hash, orchest, OrchestClusterKind)

	accessMode := corev1.ReadWriteMany
	if orchest.Spec.SingleNode != nil && *orchest.Spec.SingleNode {
		accessMode = corev1.ReadWriteOnce
	}

	spec := corev1.PersistentVolumeClaimSpec{
		AccessModes: []corev1.PersistentVolumeAccessMode{accessMode},
		Resources: corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				corev1.ResourceName(corev1.ResourceStorage): resource.MustParse(volume.VolumeSize),
			},
		},
	}

	if volume.VolumeSize != "" {
		spec.StorageClassName = &volume.VolumeSize
	}

	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metadata,
		Spec:       spec,
	}

	return pvc
}
