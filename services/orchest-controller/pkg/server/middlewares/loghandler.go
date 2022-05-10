package middlewares

import (
	"net/http"
	"runtime/debug"

	"k8s.io/klog/v2"
)

// LoggingMiddleware logs the incoming HTTP request & its duration.
func LoggingHandler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				klog.Error(
					"err", err,
					" trace ", string(debug.Stack()),
				)
			}
		}()

		klog.Infof(
			"method %s, path %s called",
			r.Method,
			r.URL.EscapedPath())
		h.ServeHTTP(w, r)
	})
}
