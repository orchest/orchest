"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
import logging
import os
import signal
import time
from concurrent.futures import ThreadPoolExecutor

from flask import Flask
from kubernetes import client as k8s_client
from kubernetes import config as k8s_config
from kubernetes import stream

from _orchest.internals import config as _config
from app.config import CONFIG_CLASS
from app.views import register_views

logging.basicConfig(level=logging.DEBUG)

signal.signal(signal.SIGTERM, lambda *args, **kwargs: _delete_pod())


def _delete_pod() -> None:
    k8s_config.load_incluster_config()
    k8s_core_api = k8s_client.CoreV1Api()
    k8s_core_api.delete_namespaced_pod(os.environ["POD_NAME"], "orchest")


def follow_update() -> None:
    try:
        _follow_update()
    except Exception as e:
        logging.error(e)
        raise
    finally:
        # Give time to the webserver to communicate that the update is
        # done.
        time.sleep(30)
        _delete_pod()


def _follow_update() -> None:
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
                log_file.write("Update failed. Try to restart Orchest.\n")
                log_file.flush()
                k8s_core_api.delete_namespaced_pod(
                    CONFIG_CLASS.UPDATE_POD_NAME,
                    namespace=_config.ORCHEST_NAMESPACE,
                )
                return
            elif phase in ["Running", "Succeeded"]:
                break
            elif phase == "Unknown":
                log_file.write("Unknown update issue. Try to restart Orchest.\n")
                log_file.flush()
                k8s_core_api.delete_namespaced_pod(
                    CONFIG_CLASS.UPDATE_POD_NAME,
                    namespace=_config.ORCHEST_NAMESPACE,
                )
                return
            else:  # Pending
                msg = pod.status.message

                # Every field could be missing, get's really ugly to
                # make this safe.
                try:
                    container_status_pull = any(
                        s.state.waiting.reason in ("ErrImagePull", "ImagePullBackOff")
                        for s in pod.status.container_statuses
                    )
                except Exception:
                    container_status_pull = False

                if container_status_pull or (
                    msg is not None
                    and ("ImagePullBackOff" in msg or "ErrImagePull" in msg)
                ):
                    msg = (
                        "Update service image pull failed, aborting the update "
                        "process."
                    )
                    logging.info(msg)
                    log_file.write(msg + "\n")
                    log_file.flush()
                    k8s_core_api.delete_namespaced_pod(
                        CONFIG_CLASS.UPDATE_POD_NAME,
                        namespace=_config.ORCHEST_NAMESPACE,
                    )
                    return

            log_file.write("Waiting for Update service to be ready.\n")
            log_file.flush()
            time.sleep(1)

        logging.info(f"Getting logs from update pod, status: {phase}")

        # Doing this instead of gettings the logs through the k8s logs
        # endpoint preserves the update bar.
        resp = stream.stream(
            k8s_core_api.connect_get_namespaced_pod_attach,
            pod.metadata.name,
            _config.ORCHEST_NAMESPACE,
            container="orchest-ctl",
            stderr=True,
            stdin=False,
            stdout=True,
            tty=True,
            _preload_content=False,
        )
        while resp.is_open():
            resp.update()
            # nl=False, wrap=False to not disrupt the progress bar.
            if resp.peek_stdout():
                msg = resp.read_stdout()
                log_file.write(msg)
                log_file.flush()
                logging.info(msg)
            if resp.peek_stderr():
                msg = resp.read_stderr()
                log_file.write(msg)
                log_file.flush()
                logging.info(msg)

        logging.info("Update pod exited.")

    with open(CONFIG_CLASS.UPDATE_COMPLETE_FILE, "w") as f:
        # The content is arbitrary, the file just needs to exist.
        f.write("true")


executor = ThreadPoolExecutor(1)


def create_app():
    app = Flask(__name__)
    app.config.from_object(CONFIG_CLASS)

    register_views(app)

    executor.submit(follow_update)
    return app
