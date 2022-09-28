package minikubereconciler

import (
	"context"
	"time"

	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/pkg/errors"
	appsv1 "k8s.io/api/apps/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	appsinformers "k8s.io/client-go/informers/apps/v1"
	"k8s.io/client-go/kubernetes"
	appslister "k8s.io/client-go/listers/apps/v1"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
)

const (
	kubeSystemNameSpace    = "kube-system"
	corednsDeployment      = "coredns"
	ingressNginxNameSpace  = "ingress-nginx"
	ingressNginxDeployment = "ingress-nginx-controller"
)

// MinikubeReconcilerController reconciles the the minikube resources in a way orchest expexts like:
// removing coredns readiness probe
type MinikubeReconcilerController struct {
	*controller.Controller[*appsv1.Deployment]

	client kubernetes.Interface

	depLister appslister.DeploymentLister

	// the list of informerSynced
	InformerSyncedList []cache.InformerSynced
}

// NewOrchestClusterController returns a new *OrchestClusterController.
func NewMinikubeReconcilerController(client kubernetes.Interface,
	depInformer appsinformers.DeploymentInformer,
) *MinikubeReconcilerController {

	informerSyncedList := make([]cache.InformerSynced, 0)

	ctrl := controller.NewController[*appsv1.Deployment](
		"minikube-reconciler",
		1,
		client,
		nil,
	)

	minikubereconciler := MinikubeReconcilerController{
		client: client,
	}

	// Deployment event handlers
	depWatcher := controller.NewControllerWatcher(ctrl)
	depInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    depWatcher.AddObject,
		UpdateFunc: depWatcher.UpdateObject,
		DeleteFunc: depWatcher.DeleteObject,
	})
	informerSyncedList = append(informerSyncedList, depInformer.Informer().HasSynced)
	minikubereconciler.depLister = depInformer.Lister()

	ctrl.InformerSyncedList = informerSyncedList
	ctrl.SyncHandler = minikubereconciler.syncDeployments
	//ctrl.ControleeGetter = occ.getOrchestCluster

	minikubereconciler.Controller = ctrl

	return &minikubereconciler
}

func (minikube *MinikubeReconcilerController) syncDeployments(ctx context.Context, key string) error {

	startTime := time.Now()
	klog.V(3).Infof("Started syncing minikube deployments: %s.", key)
	defer func() {
		klog.V(3).Infof("Finished syncing minikube deployments: %s. duration: (%v)", key, time.Since(startTime))
	}()

	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return err
	}

	if !((namespace == kubeSystemNameSpace && name == corednsDeployment) ||
		(namespace == ingressNginxNameSpace && name == ingressNginxDeployment)) {
		return nil
	}

	dep, err := minikube.depLister.Deployments(namespace).Get(name)
	if err != nil {
		if kerrors.IsNotFound(err) {
			klog.V(2).Info("Deployment %s resource not found.", key)
			return nil
		}
		// Error reading OrchestCluster - The request will be requeued.
		return errors.Wrapf(err, "failed to get to Deployment %s", key)
	}

	if !dep.GetDeletionTimestamp().IsZero() {
		klog.V(2).Info("Deployment %s is getting deleted.", key)
		return nil
	}

	if name == corednsDeployment {
		if dep.Spec.Template.Spec.Containers[0].ReadinessProbe != nil {
			clone := dep.DeepCopy()
			clone.Spec.Template.Spec.Containers[0].ReadinessProbe = nil

			klog.Info("Removing readiness probe from coredns in minikube.")

			_, err = minikube.client.AppsV1().Deployments(namespace).Update(ctx, clone, v1.UpdateOptions{})

			return err
		}
		// To avoid nginx going down during periods of high cpu
		// contention in instances with low resources.
	} else if name == ingressNginxDeployment {
		var timeoutValue int32 = 15

		container := dep.Spec.Template.Spec.Containers[0]

		if container.ReadinessProbe != nil && container.ReadinessProbe.TimeoutSeconds < timeoutValue {
			clone := dep.DeepCopy()
			clone.Spec.Template.Spec.Containers[0].ReadinessProbe.TimeoutSeconds = timeoutValue
			klog.Info("Altering readiness probe for ingress-nginx in minikube.")
			_, err = minikube.client.AppsV1().Deployments(namespace).Update(ctx, clone, v1.UpdateOptions{})
			return err
		}
		if container.LivenessProbe != nil && container.LivenessProbe.TimeoutSeconds < timeoutValue {
			clone := dep.DeepCopy()
			clone.Spec.Template.Spec.Containers[0].LivenessProbe.TimeoutSeconds = timeoutValue
			klog.Info("Altering liveness probe for ingress-nginx in minikube.")
			_, err = minikube.client.AppsV1().Deployments(namespace).Update(ctx, clone, v1.UpdateOptions{})
			return err
		}

	}

	return nil
}
