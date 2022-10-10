package orchestcluster

import (
	"context"
	"sync"
	"testing"
	"time"

	orchestv1alpha1 "github.com/orchest/orchest/services/orchest-controller/pkg/apis/orchest/v1alpha1"
	registry "github.com/orchest/orchest/services/orchest-controller/pkg/componentregistry"
	fakecomponent "github.com/orchest/orchest/services/orchest-controller/pkg/components/fake"
	"github.com/orchest/orchest/services/orchest-controller/pkg/controller"
	"github.com/orchest/orchest/services/orchest-controller/pkg/utils"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

func newHealthyComponent() registry.Component {
	return fakecomponent.NewHealthyComponent()
}

func initHealthyComponentRegistry() {
	dockerRegistryComponent := fakecomponent.NewHealthyComponent()
	argoComponent := fakecomponent.NewHealthyComponent()
	resourcesComponent := fakecomponent.NewHealthyComponent()
	databaseComponent := fakecomponent.NewHealthyComponent()
	rabbitmqComponent := fakecomponent.NewHealthyComponent()
	orchestApiComponent := fakecomponent.NewHealthyComponent()
	celeryWorkerComponent := fakecomponent.NewHealthyComponent()
	authServerComponent := fakecomponent.NewHealthyComponent()
	orchestWebserverComponent := fakecomponent.NewHealthyComponent()
	nodeAgentComponent := fakecomponent.NewHealthyComponent()
	buildKitDaemonComponent := fakecomponent.NewHealthyComponent()

	registry.ReplaceComponent(registry.DockerRegistry, dockerRegistryComponent)
	registry.ReplaceComponent(registry.ArgoWorkflow, argoComponent)
	registry.ReplaceComponent(controller.Resources, resourcesComponent)
	registry.ReplaceComponent(controller.OrchestDatabase, databaseComponent)
	registry.ReplaceComponent(controller.Rabbitmq, rabbitmqComponent)
	registry.ReplaceComponent(controller.OrchestApi, orchestApiComponent)
	registry.ReplaceComponent(controller.CeleryWorker, celeryWorkerComponent)
	registry.ReplaceComponent(controller.AuthServer, authServerComponent)
	registry.ReplaceComponent(controller.OrchestWebserver, orchestWebserverComponent)
	registry.ReplaceComponent(controller.NodeAgent, nodeAgentComponent)
	registry.ReplaceComponent(controller.BuildKitDaemon, buildKitDaemonComponent)
}

func TestRunningStateOrchestCluster(t *testing.T) {

	initHealthyComponentRegistry()

	ocController, testServer := setupTestUtils(t, utils.Minikube)
	defer testServer.server.Close()

	// prepare OrchestCluster
	clusterName := "test-cluster"
	cluster := newOrchestClusterWithFinalizerAndPhase(clusterName, orchestv1alpha1.Initializing)
	require.NoError(t, ocController.ocStore.Add(cluster))

	// return the create orchest-cluster
	testServer.orchestHandler.SetResponseBody(runtime.EncodeOrDie(codecs.LegacyCodec(orchestv1alpha1.SchemeGroupVersion), cluster))

	var wg sync.WaitGroup
	var latestState orchestv1alpha1.OrchestPhase
	wg.Add(1)
	go func() {
		defer wg.Done()
	loop:
		for {
			timeout := time.After(5 * time.Second)
			select {
			case <-timeout:
				break loop
			default:
				key := keyFunc(defaultNameSpace, clusterName)
				require.NoError(t, ocController.SyncHandler(context.TODO(), key))
				sm := ocController.getOrchestStateMachine(key)
				if sm == nil {
					// StateMachine is not registered yet
					continue
				}
				latestState = sm.currentState
				if latestState == orchestv1alpha1.Running {
					break loop
				}
			}
		}
	}()
	wg.Wait()

	require.Equal(t, orchestv1alpha1.Running, latestState)
}

func TestFaultyComponentErrorState(t *testing.T) {

	tests := []struct {
		testName           string
		faultyComponent    string
		deployedComponents []string
	}{
		{
			testName:        "Faulty orchest-database",
			faultyComponent: controller.OrchestDatabase,
			deployedComponents: []string{
				controller.Resources, controller.Rabbitmq,
			},
		},
		{
			testName:        "Faulty rabbitmq",
			faultyComponent: controller.Rabbitmq,
			deployedComponents: []string{
				controller.Resources, controller.OrchestDatabase,
			},
		},
		{
			testName:        "Faulty orchest-api",
			faultyComponent: controller.OrchestApi,
			deployedComponents: []string{
				controller.Resources, controller.OrchestDatabase, controller.OrchestApi,
			},
		},
	}
	for _, test := range tests {
		t.Run(test.testName, func(t *testing.T) {

			initHealthyComponentRegistry()
			registry.ReplaceComponent(test.faultyComponent, fakecomponent.NewFaultyComponent())

			ocController, testServer := setupTestUtils(t, utils.Minikube)
			defer testServer.server.Close()

			// prepare OrchestCluster
			clusterName := "test-cluster"
			cluster := newOrchestClusterWithFinalizerAndPhase(clusterName, orchestv1alpha1.Initializing)
			require.NoError(t, ocController.ocStore.Add(cluster))

			// return the create orchest-cluster
			testServer.orchestHandler.SetResponseBody(runtime.EncodeOrDie(codecs.LegacyCodec(orchestv1alpha1.SchemeGroupVersion), cluster))

			var wg sync.WaitGroup
			var latestState orchestv1alpha1.OrchestPhase
			var sm *OrchestStateMachine

			wg.Add(1)
			go func() {
				defer wg.Done()
			loop:
				for {
					timeout := time.After(5 * time.Second)
					select {
					case <-timeout:
						break loop
					default:
						key := keyFunc(defaultNameSpace, clusterName)
						require.NoError(t, ocController.SyncHandler(context.TODO(), key))
						if sm == nil {
							sm = ocController.getOrchestStateMachine(key)
						}

						if sm == nil {
							// StateMachine is not registered yet
							continue
						}
						latestState = sm.currentState
						if latestState == orchestv1alpha1.Error {
							break loop
						}
					}
				}
			}()
			wg.Wait()

			require.Equal(t, orchestv1alpha1.Error, latestState)

			// check for redployed components
			for _, component := range test.deployedComponents {
				require.Equal(t, true, sm.containsCondition(utils.GetCreatedEvent(component)))
			}
		})
	}

}
