package server

import (
	"context"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	orchestinformers "github.com/orchest/orchest/services/orchest-controller/pkg/client/informers/externalversions/orchest/v1alpha1"
	orchestlisters "github.com/orchest/orchest/services/orchest-controller/pkg/client/listers/orchest/v1alpha1"
	"github.com/orchest/orchest/services/orchest-controller/pkg/server/middlewares"
	"k8s.io/klog/v2"
)

type ServerConfig struct {
	Endpoint string
}

func NewDefaultServerConfig() ServerConfig {
	return ServerConfig{
		Endpoint: ":80",
	}
}

type Server struct {
	config ServerConfig

	ocLister orchestlisters.OrchestClusterLister

	router *mux.Router
}

func NewServer(config ServerConfig,
	ocInformer orchestinformers.OrchestClusterInformer) *Server {

	server := Server{
		config:   config,
		router:   mux.NewRouter(),
		ocLister: ocInformer.Lister(),
	}

	server.setupHandlers()

	return &server

}

func (s *Server) setupHandlers() {
	s.router.Use(middlewares.LoggingHandler)

	// get user followers statistics
	s.router.Methods(http.MethodGet).Path("/namespaces/{namespace}/clusters/{name}/status").HandlerFunc(s.GetOrchestsClusterStatus)
}

func (s *Server) Run(stopCh <-chan struct{}) {

	klog.Infof("Starting orchest http server")
	defer klog.Infof("Shutting down orchest http server")

	httpServer := &http.Server{
		Addr:           s.config.Endpoint,
		Handler:        s.router,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	go func() {
		if err := httpServer.ListenAndServe(); err != http.ErrServerClosed {
			klog.Fatal(err)
		}
	}()

	<-stopCh

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(ctx); err != nil {
		klog.Error(err)
	}
}
