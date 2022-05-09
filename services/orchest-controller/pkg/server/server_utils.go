package server

import (
	"bytes"
	"encoding/json"
	"net/http"
)

// mimeType represents various MIME type used API responses.
type mimeType string

const (
	// Means no response type.
	mimeNone mimeType = ""
	// Means response type is JSON.
	mimeJSON mimeType = "application/json"
	// Means response type is XML.
	mimeXML mimeType = "application/xml"
)

// Encodes the response headers into JSON format.
func encodeResponseJSON(response interface{}) []byte {
	var bytesBuffer bytes.Buffer
	e := json.NewEncoder(&bytesBuffer)
	e.Encode(response)
	return bytesBuffer.Bytes()
}

func writeResponse(w http.ResponseWriter, statusCode int, response []byte, mType mimeType) {
	if mType != mimeNone {
		w.Header().Set("Content-Type", string(mType))
	}
	w.WriteHeader(statusCode)
	if response != nil {
		w.Write(response)
		w.(http.Flusher).Flush()
	}
}

func writeJsonResponse(w http.ResponseWriter, statusCode int, response interface{}) {
	encodedResponse := encodeResponseJSON(response)
	writeResponse(w, statusCode, encodedResponse, mimeJSON)
}

// writeErrorResponseJSON - writes error response in JSON format;
// useful for admin APIs.
func writeErrorResponseJSON(w http.ResponseWriter, statusCode int, err error) {
	// Generate error response.
	encodedErrorResponse := encodeResponseJSON(err.Error())
	writeResponse(w, statusCode, encodedErrorResponse, mimeJSON)
}
