"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor

from flask import Flask
from kubernetes import client as k8s_client
from kubernetes import config as k8s_config
from kubernetes import watch

from _orchest.internals import config as _config
from app.config import CONFIG_CLASS
from app.views import register_views

logging.basicConfig(level=logging.DEBUG)


def follow_update() -> None:
    # Make sure only 1 worker can write to the file. This is just a
    # failsafe in case the number of gunicorn workers is scaled.
    try:
        os.mkdir(CONFIG_CLASS.UPDATE_STARTED_FILE)
    except FileExistsError:
        return

    k8s_config.load_incluster_config()
    k8s_core_api = k8s_client.CoreV1Api()

    logging.info("Initiating update logs file.")
    with open(CONFIG_CLASS.UPDATE_FILE_LOG, "w") as log_file:
        while True:
            try:
                pod = k8s_core_api.read_namespaced_pod(
                    CONFIG_CLASS.UPDATE_POD_NAME,
                    namespace=_config.ORCHEST_NAMESPACE,
                )
            except k8s_client.ApiException as e:
                if e.status != 404:
                    raise
                logging.info("Waiting for pod to exist.")
                time.sleep(0.2)
                continue

            phase = pod.status.phase
            logging.info(f"Update pod status: {phase}.")
            if phase in ["Failed"]:
                log_file.write("Update failed. Try to restart Orchest.")
                log_file.flush()
                return
            elif phase in ["Running", "Succeeded"]:
                break
            elif phase == "Unknown":
                log_file.write("Unknown update issue. Try to restart Orchest.")
                log_file.flush()
                return
            else:  # Pending
                msg = pod.get("message", "")
                if "ImagePullBackOff" in msg or "ErrImagePull" in msg:
                    msg = "Update service image pull failed."
                    logging.info(msg)
                    log_file.write(msg)
                    log_file.flush()
                    return

            log_file.write("Waiting for Update service to be ready.")
            log_file.flush()
            time.sleep(1)

        logging.info(f"Getting logs from update pod, status: {phase}")
        w = watch.Watch()
        for event in w.stream(
            k8s_core_api.read_namespaced_pod_log,
            name=CONFIG_CLASS.UPDATE_POD_NAME,
            container="orchest-ctl",
            namespace=_config.ORCHEST_NAMESPACE,
            follow=True,
        ):
            log_file.write(event)
            log_file.flush()
            logging.info(event)
        logging.info("Update pod exited.")

    with open(CONFIG_CLASS.UPDATE_COMPLETE_FILE, "w") as f:
        f.write("true")


executor = ThreadPoolExecutor(1)


def create_app():
    app = Flask(__name__)
    app.config.from_object(CONFIG_CLASS)

    register_views(app)

    executor.submit(follow_update)
    return app
