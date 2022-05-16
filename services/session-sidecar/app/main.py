import json
import logging
import os
import re
import signal
import sys
import time
import uuid
from multiprocessing.pool import ThreadPool
from typing import List

from kubernetes import client, config, watch

from config import Config


def get_log_dir_path() -> str:
    return os.path.join(
        Config.PROJECT_DIR,
        Config.LOGS_PATH.format(
            pipeline_uuid=os.environ.get("ORCHEST_PIPELINE_UUID", "")
        ),
    )


def get_service_log_file_path(service) -> str:
    return os.path.join(get_log_dir_path(), f"{service}.log")


def create_log_dir() -> None:
    log_dir_path = get_log_dir_path()
    os.makedirs(log_dir_path, exist_ok=True)


def get_services_to_follow() -> List[str]:
    services_to_follow = []
    with open(Config.PIPELINE_FILE_PATH) as pipeline:
        data = json.load(pipeline)
        for service in data.get("services", {}).values():
            if Config.SESSION_TYPE in service.get("scope", []):
                services_to_follow.append(service["name"])
    return services_to_follow


def follow_service_logs(service):
    config.load_incluster_config()
    k8s_core_api = client.CoreV1Api()

    logging.info(f"Initiating logs file for service {service}.")
    with open(get_service_log_file_path(service), "w") as log_file:
        # Used by the log_streamer.py to infer that a new session
        # has started, i.e. the previous logs can be discarded.  The
        # file streamer has this contract to understand that some
        # logs belong to a different session, i.e. different UUID
        # implies different session.
        log_file.write("%s\n" % str(uuid.uuid4()))
        log_file.flush()

        while True:
            pods = k8s_core_api.list_namespaced_pod(
                namespace=Config.NAMESPACE,
                label_selector=f"session_uuid={Config.SESSION_UUID},app={service}",
            )
            if not pods.items:
                logging.info(f"{service} is not up yet.")
                continue

            # Note: this means that the session sidecar makes use of the
            # fact that user services are single pod.
            pod = pods.items[0]

            phase = pod.status.phase
            logging.info(f"{service} phase is {phase}.")
            if phase in ["Failed", "Running", "Succeeded"]:
                break
            elif phase == "Unknown":
                log_file.write("Unknown service issue.")
                log_file.flush()
                return
            else:  # Pending
                logging.info(f"{service} is pending.")
                # Based on the state of the service it may return an
                # object without a get apparently.
                if hasattr(pod, "get"):
                    msg = pod.get("message", "")
                    if "ImagePullBackOff" in msg or "ErrImagePull" in msg:
                        logging.info(f"{service} image pull failed.")
                        log_file.write("Image pull failed.")
                        log_file.flush()
                        return
            time.sleep(1)

        logging.info(f"Getting logs from service {service}, pod {pod.metadata.name}.")
        w = watch.Watch()
        for event in w.stream(
            k8s_core_api.read_namespaced_pod_log,
            name=pod.metadata.name,
            container=f"{service}-{Config.SESSION_UUID}",
            namespace=Config.NAMESPACE,
            follow=True,
        ):
            log_file.write(event)
            log_file.write("\n")
            log_file.flush()
        logging.info(f"No more logs for {service}.")


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *args, **kwargs: sys.exit(0))
    logging.getLogger().setLevel(logging.INFO)

    # Needs to be here since the logs directory does not exists for
    # project snapshots of jobs.
    create_log_dir()

    # Cleanup old service logs on session start, so that if a container
    # does not emit any output, both by design or because it failed to
    # start, no old logs will be shown.
    log_dir_path = get_log_dir_path()
    for fname in os.listdir(log_dir_path):
        path = os.path.join(log_dir_path, fname)
        if (
            # Pipeline steps logs are of no concern to the sidecar.
            # NOTE: Should it take care of those as well?
            not re.search(r"^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}\.log$", fname)
            and os.path.isfile(path)
            and path.endswith(".log")
        ):
            os.remove(path)

    logs_path = get_service_log_file_path("<service>")
    logging.info(f"Storing logs in {logs_path}.")

    services_to_follow = get_services_to_follow()
    logging.info(
        f"Following services: {services_to_follow} for {Config.SESSION_TYPE} session."
    )
    pool = ThreadPool(len(services_to_follow))
    pool.map(follow_service_logs, services_to_follow)
