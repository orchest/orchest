import http
import re
import urllib
import json

from orchest import app, db
from flask import Blueprint
from flask import Flask, Blueprint, request, Response, url_for
from werkzeug.datastructures import Headers
from werkzeug.exceptions import NotFound

import logging

proxy = Blueprint('proxy', __name__)


def iterform(multidict):
    for key in multidict.keys():
        for value in multidict.getlist(key):
            yield (key.encode("utf8"), value.encode("utf8"))


def parse_host_port(h):
    """Parses strings in the form host[:port]"""
    host_port = h.split(":", 1)
    if len(host_port) == 1:
        return (h, 80)
    else:
        host_port[1] = int(host_port[1])
        return host_port


# For RESTful Service
@proxy.route('/api-proxy/', methods=["GET", "POST", "PUT", "DELETE"])
@proxy.route('/api-proxy/<path:file>', methods=["GET", "POST", "PUT", "DELETE"])
def proxy_request(file=""):
    hostname, port = parse_host_port(app.config['ORCHEST_API_ADDRESS'])

    logging.info("H: '%s' P: %d" % (hostname, port))
    logging.info("F: '%s'" % (file))

    # Whitelist a few headers to pass on
    request_headers = {}
    for h in ["Cookie", "Referer", "X-Csrf-Token", "Content-Type"]:
        if h in request.headers:
            request_headers[h] = request.headers[h]

    if request.query_string:
        path = "/%s?%s" % (file, request.query_string)
    else:
        path = "/" + file

    if request.method == "POST" or request.method == "PUT":

        if request.form:
            form_data = list(iterform(request.form))
            form_data = urllib.parse.urlencode(form_data)
        if request.json:
            form_data = json.dumps(request.json)
        request_headers["Content-Length"] = len(form_data)
    else:
        form_data = None

    conn = http.client.HTTPConnection(hostname, port)
    conn.request(request.method, path, body=form_data, headers=request_headers)
    resp = conn.getresponse()

    # Clean up response headers for forwarding
    d = {}
    response_headers = Headers()
    for key, value in resp.getheaders():
        
        logging.info("HEADER: '%s':'%s'" % (key, value))
    
        d[key.lower()] = value
        if key.lower() in ["content-length", "connection", "content-type", "location"]:
            continue

        if key == "set-cookie":
            cookies = value.split(",")
            [response_headers.add(key, c) for c in cookies]
        else:
            response_headers.add(key, value)

    contents = resp.read()

    flask_response = Response(response=contents,
                              status=resp.status,
                              headers=response_headers,
                              content_type=resp.getheader('content-type'))
    return flask_response
