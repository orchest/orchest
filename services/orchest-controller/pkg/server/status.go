package server

import (
	"net/http"

	"github.com/gorilla/mux"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
)

// Get Orchest Cluster Logs
func (s *Server) GetOrchestsClusterStatus(w http.ResponseWriter, r *http.Request) {
	// TODO: add swagger docs

	vars := mux.Vars(r)

	// namespace of the orchest cluster
	namespace := vars["namespace"]

	// name of the orchest cluster
	name := vars["name"]

	orchest, err := s.ocLister.OrchestClusters(namespace).Get(name)
	if err != nil && !kerrors.IsNotFound(err) {
		writeErrorResponseJSON(w, http.StatusInternalServerError, err)
		return
	} else if err != nil && kerrors.IsNotFound(err) {
		writeErrorResponseJSON(w, http.StatusNotFound, err)
		return
	}

	writeJsonResponse(w, http.StatusOK, orchest.Status)
}
