import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor

import docker
from flask import request

from _orchest.internals.utils import run_orchest_ctl

executor = ThreadPoolExecutor(1)

UPDATE_FILE_LOG = "/tmp/update-log"
UPDATE_COMPLETE_FILE = "/tmp/update-complete"


def log_update(message):
    try:
        with open(UPDATE_FILE_LOG, "a") as log_file:
            log_file.write(message)

    except Exception as e:
        logging.error("Failed to write to update log")
        logging.error(e)


def background_task(json_obj):

    client = docker.from_env()

    try:
        log_update("Starting update ...\n")

        # get latest orchest-ctl
        log_update("Pulling orchest-ctl ...\n")
        try:
            client.images.pull("orchest/orchest-ctl:latest")
        except docker.errors.APIError as e:
            logging.error(e)
        log_update("Pulled orchest-ctl. Starting update ...\n")

        try:
            container = run_orchest_ctl(client, ["update", "--mode=web"])

            for line in container.logs(stream=True):
                log_update(line.decode())
        except Exception as e:
            log_update("Error run_orchest_ctl: %s" % e)

        log_update(
            "Update complete! Restarting Orchest "
            "... (this can take up to 15 seconds)\n"
        )

    except Exception as e:
        log_update("Error during updating: %s" % e)

    with open(UPDATE_COMPLETE_FILE, "w") as f:
        f.write("true")

    # wait at most 10 seconds for file to be read
    for _ in range(10):
        if os.path.exists(UPDATE_COMPLETE_FILE):
            time.sleep(1)
        else:
            break

    try:

        # Restart Orchest in either regular or dev mode.
        ctl_command = ["restart"]

        # Note: this depends on the detached
        # Docker orchest_ctl finishing
        # without waiting for the response
        # as the update-server is shutdown as part
        # of the restart command.
        dev_mode = json_obj.get("mode") == "dev"
        if dev_mode:
            ctl_command += ["--mode=dev"]

        run_orchest_ctl(client, ctl_command)

    except docker.errors.APIError as e:
        print(e)


def register_views(app):
    @app.route("/update-server/heartbeat", methods=["GET"])
    def heartbeat():
        return "", 200

    @app.route("/update-server/update-status", methods=["GET"])
    def update_status():
        try:
            content = ""
            with open(UPDATE_FILE_LOG, "r") as f:
                content = f.read()

            try:
                if os.path.exists(UPDATE_COMPLETE_FILE):
                    os.remove(UPDATE_COMPLETE_FILE)
            except Exception as e:
                logging.error("Failed to clear update complete file.")
                logging.error(e)

            return content, 200

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
