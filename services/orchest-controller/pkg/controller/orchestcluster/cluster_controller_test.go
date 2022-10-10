package orchestcluster

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/tools/cache"
	utiltesting "k8s.io/client-go/util/testing"
	"k8s.io/klog/v2"
)

var (
	alwaysReady      = func() bool { return true }
	scheme           = utils.GetScheme()
	codecs           = serializer.NewCodecFactory(scheme)
	defaultNameSpace = "orchest"
	True             = true
	False            = false
)

func keyFunc(namespace, name string) string {
	return namespace + "/" + name
}

func newNode(name string, label map[string]string) *corev1.Node {
	return &corev1.Node{
		TypeMeta: metav1.TypeMeta{APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Labels:    label,
			Namespace: metav1.NamespaceNone,
		},
		Status: v1.NodeStatus{
			Conditions: []v1.NodeCondition{
				{Type: v1.NodeReady, Status: v1.ConditionTrue},
			},
			Allocatable: v1.ResourceList{
				v1.ResourcePods: resource.MustParse("100"),
			},
		},
	}
}

func newService(name, IP string) *corev1.Service {
	return &corev1.Service{
		TypeMeta: metav1.TypeMeta{APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: metav1.NamespaceNone,
		},
		Spec: v1.ServiceSpec{
			ClusterIP: IP,
		},
	}
}

func newOrchestCluster(name string) *orchestv1alpha1.OrchestCluster {

	return &orchestv1alpha1.OrchestCluster{
		ObjectMeta: metav1.ObjectMeta{
			Name:            name,
			Namespace:       "orchest",
			ResourceVersion: "v1alpha1",
		},
		Spec: orchestv1alpha1.OrchestClusterSpec{
			SingleNode: &True,
		},
	}
}

func newOrchestClusterWithPhase(name string, phase orchestv1alpha1.OrchestPhase) *orchestv1alpha1.OrchestCluster {

	cluster := newOrchestCluster(name)
	cluster.Status = &orchestv1alpha1.OrchestClusterStatus{Phase: phase}
	return cluster
}

func newOrchestClusterWithFinalizerAndPhase(name string, phase orchestv1alpha1.OrchestPhase) *orchestv1alpha1.OrchestCluster {

	cluster := newOrchestCluster(name)
	cluster.Status = &orchestv1alpha1.OrchestClusterStatus{Phase: phase}
	cluster.Finalizers = []string{
		orchestv1alpha1.Finalizer,
	}
	return cluster
}

type testServer struct {
	server *httptest.Server

	orchestHandler *utiltesting.FakeHandler

	serviceHandler *utiltesting.FakeHandler

	nodeHandler *utiltesting.FakeHandler
}

func makeTestServer(t *testing.T, scheme *runtime.Scheme) *testServer {

	orchestHandler := utiltesting.FakeHandler{
		StatusCode: http.StatusOK,
		ResponseBody: runtime.EncodeOrDie(
			codecs.LegacyCodec(orchestv1alpha1.SchemeGroupVersion), &orchestv1alpha1.OrchestCluster{}),
	}

	nodeHandler := utiltesting.FakeHandler{
		StatusCode: http.StatusOK,
		ResponseBody: runtime.EncodeOrDie(
			codecs.LegacyCodec(corev1.SchemeGroupVersion), &corev1.Node{}),
	}

	serviceHandelr := utiltesting.FakeHandler{
		StatusCode: http.StatusOK,
		ResponseBody: runtime.EncodeOrDie(
			codecs.LegacyCodec(corev1.SchemeGroupVersion), &corev1.Service{}),
	}

	mux := http.NewServeMux()
	mux.Handle("/apis/orchest.io/v1alpha1/namespaces/"+defaultNameSpace+"/orchestclusters", &orchestHandler)
	mux.Handle("/apis/orchest.io/v1alpha1/namespaces/"+defaultNameSpace+"/orchestclusters/", &orchestHandler)
	mux.Handle("/api/v1/services", &serviceHandelr)
	mux.Handle("/api/v1/namespaces/"+defaultNameSpace+"/services/", &serviceHandelr)
	mux.Handle("/api/v1/nodes", &nodeHandler)
	mux.HandleFunc("/", func(res http.ResponseWriter, req *http.Request) {
		t.Errorf("unexpected request: %v", req.RequestURI)
		klog.Infof("unexpected request: %v", req.RequestURI)
		http.Error(res, "", http.StatusNotFound)
	})

	return &testServer{
		server:         httptest.NewServer(mux),
		orchestHandler: &orchestHandler,
		serviceHandler: &serviceHandelr,
		nodeHandler:    &nodeHandler,
	}
}

type orchestClusterController struct {
	*OrchestClusterController

	ocStore cache.Store
}

func setupTestUtils(t *testing.T, k8sDistro utils.KubernetesDistros) (*orchestClusterController, *testServer) {

	testServer := makeTestServer(t, scheme)

	// Initialize clients
	kClient, oClient, gClient := utils.GetClientsOrDie(false, testServer.server.URL, scheme)

	controllerConfig := NewDefaultControllerConfig()
	oClusterInformer := utils.NewOrchestClusterInformer(oClient)

	oClusterController := NewOrchestClusterController(kClient,
		oClient,
		gClient,
		scheme,
		controllerConfig,
		k8sDistro,
		oClusterInformer)

	for i := range oClusterController.InformerSyncedList {
		oClusterController.InformerSyncedList[i] = alwaysReady
	}

	return &orchestClusterController{
		OrchestClusterController: oClusterController,
		ocStore:                  oClusterInformer.Informer().GetStore(),
	}, testServer

}

func TestToInitializingStateFromUnknown(t *testing.T) {

	ocController, testServer := setupTestUtils(t, utils.Minikube)
	defer testServer.server.Close()

	// prepare OrchestCluster
	clusterName := "test-cluster"
	cluster := newOrchestCluster(clusterName)
	require.NoError(t, ocController.ocStore.Add(cluster))

	// return the create orchest-cluster
	testServer.orchestHandler.SetResponseBody(runtime.EncodeOrDie(codecs.LegacyCodec(orchestv1alpha1.SchemeGroupVersion), cluster))

	require.NoError(t, ocController.SyncHandler(context.TODO(), keyFunc(defaultNameSpace, clusterName)))

	// Twi call is expected, one for getting the orchest, the other updating the status
	testServer.orchestHandler.ValidateRequestCount(t, 2)
}

func TestAddingFinalizerAfterInitializing(t *testing.T) {

	ocController, testServer := setupTestUtils(t, utils.Minikube)
	defer testServer.server.Close()

	clusterName := "test-cluster"
	// prepare OrchestCluster
	cluster := newOrchestClusterWithPhase(clusterName, orchestv1alpha1.Initializing)
	require.NoError(t, ocController.ocStore.Add(cluster))

	// return the create orchest-cluster
	testServer.orchestHandler.SetResponseBody(runtime.EncodeOrDie(codecs.LegacyCodec(orchestv1alpha1.SchemeGroupVersion), cluster))

	require.NoError(t, ocController.SyncHandler(context.TODO(), keyFunc(defaultNameSpace, clusterName)))

	// Now we call the  syncHandler again, and the finalizer should be added
	require.NoError(t, ocController.SyncHandler(context.TODO(), keyFunc(defaultNameSpace, clusterName)))

	// two call is expected, one for getting the orchest, and one for adding the finalizer
	testServer.orchestHandler.ValidateRequestCount(t, 2)
}

func TestUpdateWithDefaulrAfterInitializing(t *testing.T) {

	ocController, testServer := setupTestUtils(t, utils.Minikube)
	defer testServer.server.Close()

	clusterName := "test-cluster"
	// prepare OrchestCluster
	cluster := newOrchestClusterWithPhase(clusterName, orchestv1alpha1.Initializing)
	// we add the finalizer, so it won't be added again by the controller
	cluster.Finalizers = []string{
		orchestv1alpha1.Finalizer,
	}
	// we should change the observed generation and the generation of the orchest, so the values will be updates
	cluster.Generation = 2                // new generation
	cluster.Status.ObservedGeneration = 1 // old generation
	require.NoError(t, ocController.ocStore.Add(cluster))

	// return the create orchest-cluster
	testServer.orchestHandler.SetResponseBody(runtime.EncodeOrDie(codecs.LegacyCodec(orchestv1alpha1.SchemeGroupVersion), cluster))

	// set the example response fot the service
	service := newService("docker-registry", "10.10.10.10")
	testServer.serviceHandler.SetResponseBody(runtime.EncodeOrDie(codecs.LegacyCodec(corev1.SchemeGroupVersion), service))

	require.NoError(t, ocController.SyncHandler(context.TODO(), keyFunc(defaultNameSpace, clusterName)))

	// Now we call the  syncHandler again, and the values should be updated
	require.NoError(t, ocController.SyncHandler(context.TODO(), keyFunc(defaultNameSpace, clusterName)))

	// two call is expected to orchestHandler, one for getting the orchest, and one for updating with default values
	testServer.orchestHandler.ValidateRequestCount(t, 3)

	// one call is expected to serviceHandler, getting the docker-registry service
	testServer.serviceHandler.ValidateRequestCount(t, 1)
}
