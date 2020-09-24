import os
import docker
import requests
import logging

from flask import request, Response
from shelljob import proc


def register_views(app):

    def auth(request):

        # get auth IP
        client = docker.from_env()

        try:
            ip_address = client.containers.get("auth-server").attrs['NetworkSettings']['Networks']['orchest']['IPAddress']
            
            resp = requests.get("http://%s/auth" % ip_address, cookies=request.cookies)

            if resp.status_code == 200:
                return True
            else:
                logging.info("Auth disallowed")
                return False

        except Exception as e:
            logging.info("Exception on auth %s" % e)
            return False


    @app.route("/update", methods=["GET"])
    def update():

        if auth(request):

            arguments = []

            if "dev" in request.args and request.args.get("dev") == "true":
                arguments.append("-m dev")

            g = proc.Group()
            _ = g.run( [ "/bin/bash", "-c", "cd \"%s\"; ./update-orchest.sh %s" % (os.path.join(app.config["ORCHEST_ROOT"], "orchest", "update-service", "app", "scripts"), " ".join(arguments)) ] )

            def read_process():
                while g.is_pending():
                    lines = g.readlines()
                    for _, line in lines:
                        yield line

            return Response( read_process(), mimetype= 'text/plain', headers={"X-Accel-Buffering": "No"})
        else:
            return '', 403