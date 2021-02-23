import logging
from concurrent.futures import ThreadPoolExecutor

import docker
from flask import request

from _orchest.internals.utils import run_orchest_ctl

executor = ThreadPoolExecutor(1)

UPDATE_FILE_LOG = "/tmp/update-log"


def background_task(json_obj):

    client = docker.from_env()

    try:
        with open(UPDATE_FILE_LOG, "w") as log_file:

            log_file.write("Starting update ...\n")

            # get latest orchest-ctl
            log_file.write("Pulling orchest-ctl ...\n")
            try:
                client.images.pull("orchest/orchest-ctl:latest")
            except docker.errors.APIError as e:
                logging.error(e)
            log_file.write("Pulled orchest-ctl. Starting update ...\n")

            try:
                container = run_orchest_ctl(client, ["update", "--mode=web"])

                for line in container.logs(stream=True):
                    log_file.write(line.decode())
            except Exception as e:
                log_file.write("Error run_orchest_ctl: %s" % e)

            log_file.write(
                "Update complete! Restarting Orchest "
                "... (this can take up to 15 seconds)\n"
            )

    except Exception as e:
        log_file.write("Error during updating: %s" % e)

    # kill self
    try:
        container = client.containers.get("nginx-proxy")
        container.kill()
        container.remove()

        # restart Orchest in either dev mode
        start_command = ["start"]

        dev_mode = json_obj.get("mode") == "dev"
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

    @app.route("/update-server/update-status", methods=["GET"])
    def update_status():
        try:
            with open(UPDATE_FILE_LOG, "r") as f:
                return f.read(), 200
        except Exception:
            return "Could not check update status.", 500

    @app.route("/update-server/update", methods=["POST"])
    def update():

        if app.config.get("UPDATING") is not True:
            app.config["UPDATING"] = True

            executor.submit(background_task, request.json)
            return ""
        else:
            return "Update in progress", 423
