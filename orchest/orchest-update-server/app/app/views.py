import os
import docker
import requests
import logging
import time

from flask import request, Response
from shelljob import proc

from app.utils import orchest_ctl


def register_views(app):

    @app.route("/update-server/heartbeat", methods=["GET"])
    def heartbeat():
        return '', 200


    @app.route("/update-server/update", methods=["GET"])
    def update():

        dev_mode = False
        if request.args.get('mode') == 'dev':
            dev_mode = True

        def streaming_update(dev_mode):
            
            client = docker.from_env()

            yield "Starting update ...\n"

            # get latest orchest-ctl
            yield "Pulling orchest-ctl ...\n"
            try:
                client.images.pull("orchest-ctl:latest")
            except docker.errors.APIError as e:
                logging.error(e)
            yield "Pulled orchest-ctl. Starting update ...\n"

            container = orchest_ctl(client, ["update"])
            
            for line in container.logs(stream=True):
                yield line.decode()

            # restart Orchest in either dev mode
            start_command = ["start"]
            if dev_mode:
                start_command += ["dev"]

            orchest_ctl(client, start_command)

            # TODO: kill orchest-update-server in the background after timeout
            yield "Update complete!"

            
        return Response( streaming_update(dev_mode), mimetype= 'text/plain', headers={"X-Accel-Buffering": "No"})