import logging
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

import docker
import requests
from flask import Response, request

from _orchest.internals.utils import run_orchest_ctl

executor = ThreadPoolExecutor(1)


def background_task(dev_mode):
    client = docker.from_env()

    # kill self
    try:
        container = client.containers.get("nginx-proxy")
        container.kill()
        container.remove()

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
        return "", 200

    @app.route("/update-server/update", methods=["POST"])
    def update():
        def streaming_update(json_obj):
            try:
                dev_mode = json_obj.get("mode") == "dev"
                client = docker.from_env()

                yield "Starting update ...\n"

                # get latest orchest-ctl
                yield "Pulling orchest-ctl ...\n"
                try:
                    client.images.pull("orchest/orchest-ctl:latest")
                except docker.errors.APIError as e:
                    logging.error(e)
                yield "Pulled orchest-ctl. Starting update ...\n"

                try:
                    container = run_orchest_ctl(client, ["update", "--mode=web"])

                    for line in container.logs(stream=True):
                        yield line.decode()
                except Exception as e:
                    yield "Error run_orchest_ctl: %s" % e

                yield "Update complete! Restarting Orchest ... (this can take up to 15 seconds)\n"

                executor.submit(background_task, dev_mode)
            except Exception as e:
                yield "Error during updating: %s" % e

        return Response(
            streaming_update(request.json),
            mimetype="text/html",
            headers={"X-Accel-Buffering": "No"},
        )
