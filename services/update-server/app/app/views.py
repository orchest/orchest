import os
import docker
import requests
import logging
import time
from concurrent.futures import ThreadPoolExecutor

from flask import request, Response
import os
import subprocess
import time
from _orchest.internals.utils import run_orchest_ctl

executor = ThreadPoolExecutor(1)

def background_task(dev_mode):
    client = docker.from_env()

    # kill self
    try:
        container = client.containers.get("nginx-proxy")
        container.kill()
        
        # restart Orchest in either dev mode
        start_command = ["start"]
        if dev_mode:
            start_command += ["dev"]

        run_orchest_ctl(client, start_command)

        container = client.containers.get("update-server")
        container.kill()
    except docker.errors.APIError as e:
        print(e)


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
                client.images.pull("orchestsoftware/orchest-ctl:latest")
            except docker.errors.APIError as e:
                logging.error(e)
            yield "Pulled orchest-ctl. Starting update ...\n"

            container = run_orchest_ctl(client, ["update", "web"])
            
            for line in container.logs(stream=True):
                yield line.decode()

            yield "Update complete! Restarting Orchest ... (this can take up to 15 seconds)\n"

            executor.submit(background_task, dev_mode)


        return Response( streaming_update(dev_mode), mimetype='text/html', headers={"X-Accel-Buffering": "No"})