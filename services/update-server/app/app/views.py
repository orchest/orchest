import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor

import docker
from flask import jsonify

from _orchest.internals.utils import run_orchest_ctl
from app.config import CONFIG_CLASS

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


def background_task():

    client = docker.from_env()

    dev_mode = CONFIG_CLASS.FLASK_ENV == "development"
    cloud_mode = CONFIG_CLASS.CLOUD

    try:
        log_update("Starting update ...\n")

        if not dev_mode:
            # get latest orchest-ctl
            log_update("Pulling orchest-ctl ...\n")
            try:
                client.images.pull("orchest/orchest-ctl:latest")
            except docker.errors.APIError as e:
                logging.error(e)
            log_update("Pulled orchest-ctl. Starting update ...\n")

        try:
            cmd = ["update", "--mode=web"]
            if dev_mode:
                cmd.append("--dev")
            container = run_orchest_ctl(client, cmd)

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
        # Restart Orchest given the flags.
        ctl_command = ["restart"]

        # Note that it won't work as --port {port}.
        ctl_command.append(f"--port={CONFIG_CLASS.ORCHEST_PORT}")

        if dev_mode:
            ctl_command.append("--dev")

        if cloud_mode:
            ctl_command.append("--cloud")

        # Note: this depends on the detached Docker orchest_ctl
        # finishing without waiting for the response as the
        # update-server is shutdown as part of the restart command.
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
            updating = True

            try:
                if os.path.exists(UPDATE_COMPLETE_FILE):
                    updating = False
                    os.remove(UPDATE_COMPLETE_FILE)
            except Exception as e:
                logging.error("Failed to clear update complete file.")
                logging.error(e)

            with open(UPDATE_FILE_LOG, "r") as f:
                content = f.read()

            return jsonify({"updating": updating, "update_output": content}), 200

        except Exception:
            return "Could not check update status.", 500

    @app.route("/update-server/update", methods=["POST"])
    def update():

        if app.config.get("UPDATING") is not True:
            app.config["UPDATING"] = True

            executor.submit(background_task)
            return ""
        else:
            return "Update in progress", 423
