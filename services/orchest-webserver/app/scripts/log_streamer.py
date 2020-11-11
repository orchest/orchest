#!/usr/bin/env python3

import socketio
import logging
import os
import sys
import html

from threading import Lock
from datetime import datetime, timedelta
from _orchest.internals import config as _config

# timeout after 2 minutes, heartbeat should be sent every minute
HEARTBEAT_TIMEOUT = timedelta(minutes=2)

log_file_store = {}
file_handles = {}


lock = Lock()


class LogFile:
    def __init__(
        self,
        session_uuid,
        pipeline_uuid,
        project_uuid,
        project_path,
        step_uuid,
        pipeline_run_uuid=None,
        experiment_uuid=None,
    ):
        self.session_uuid = session_uuid
        self.pipeline_uuid = pipeline_uuid
        self.project_uuid = project_uuid
        self.project_path = project_path
        self.step_uuid = step_uuid
        self.pipeline_run_uuid = pipeline_run_uuid
        self.experiment_uuid = experiment_uuid
        self.log_uuid = ""
        self.last_heartbeat = datetime.now()


def file_reader_loop(sio):

    logging.info("Entered file_reader_loop")

    while True:

        with lock:

            for session_uuid, _ in log_file_store.items():
                try:
                    read_emit_all_lines(file_handles[session_uuid], sio, session_uuid)
                except Exception as e:
                    logging.info(
                        "call to read_emit_all_lines failed %s (%s)" % (e, type(e))
                    )

        sio.sleep(0.01)


def read_emit_all_lines(file, sio, session_uuid):

    if session_uuid not in log_file_store:
        logging.warn("session_uuid[%s] not in log_file_store" % session_uuid)
        return

    if session_uuid not in file_handles:
        logging.warn("session_uuid[%s] not in file_handles" % session_uuid)
        return

    # check if heartbeat has timed-out
    if log_file_store[session_uuid].last_heartbeat < datetime.now() - HEARTBEAT_TIMEOUT:
        logging.info("Clearing %s session due to heartbeat timeout." % session_uuid)
        clear_log_file(session_uuid)
        return

    # check if log_uuid is current log_uuid
    try:
        latest_log_file = open(get_log_path(log_file_store[session_uuid]), "r")
        latest_log_file.seek(0)
        read_log_uuid = latest_log_file.readline().strip()
    except IOError as e:
        logging.warn("Could not read latest log file: %s" % e)
        return
    except Exception as e:
        logging.error(
            "Could not read latest_log_file for session_uuid[%s]" % session_uuid
        )
        return

    if (
        read_log_uuid != log_file_store[session_uuid].log_uuid
        and len(read_log_uuid) == 36
    ):  # length of valid uuid

        logging.info(
            "New log_uuid found, resetting pty. Debug info: read_log_uuid[%s] stored_log_uuid[%s] session_uuid[%s]."
            % (read_log_uuid, log_file_store[session_uuid].log_uuid, session_uuid)
        )

        sio.emit(
            "pty-log-manager",
            {"action": "pty-reset", "session_uuid": session_uuid},
            namespace="/pty",
        )

        log_file_store[session_uuid].log_uuid = read_log_uuid

        # new log file detected - swap file handle
        try:
            file_handles[session_uuid].close()
        except IOError as e:
            logging.warn(
                "Failed to close file %s for session_uuid %s" % (e, session_uuid)
            )
        except Exception as e:
            logging.error("File handle close error %s" % e)

        file_handles[session_uuid] = latest_log_file

        return
    else:

        try:
            latest_log_file.close()
        except IOError as e:
            logging.warn(
                "Failed to close new log file %s for session_uuid %s"
                % (e, session_uuid)
            )

    line_buffer = []

    while True:

        try:
            line = file.readline()

            try:
                line = html.unescape(line)
            except Exception as e:
                logging.warn("Error escaping line %s" % line)

        except IOError as e:
            raise Exception("IOError reading log file %s" % e)
        except Exception as e:
            raise e

        # readline returns the empty string if the end of the file has been reached
        if line != "":
            line_buffer.append(line)
        else:
            if len(line_buffer) > 0:
                sio.emit(
                    "pty-log-manager",
                    {
                        "output": "".join(line_buffer).rstrip(),
                        "action": "pty-broadcast",
                        "session_uuid": session_uuid,
                    },
                    namespace="/pty",
                )
            break


# TODO: reuse (between Flask app and process scripts) and simplify code to get the correct pipeline path
# There are currently two scenarios: a pipeline is in the userdir/pipelines or
# as a pipeline run in experiments.
def get_project_dir(
    pipeline_uuid,
    project_uuid,
    project_path,
    pipeline_run_uuid=None,
    experiment_uuid=None,
):

    pipeline_dir_parts = ["/userdir"]

    if pipeline_run_uuid is not None and experiment_uuid is not None:
        pipeline_dir_parts += [
            "experiments",
            project_uuid,
            pipeline_uuid,
            experiment_uuid,
            pipeline_run_uuid,
        ]
    else:
        pipeline_dir_parts += ["projects", project_path]

    return os.path.join(*pipeline_dir_parts)


def get_log_path(log_file):

    project_dir = get_project_dir(
        log_file.pipeline_uuid,
        log_file.project_uuid,
        log_file.project_path,
        log_file.pipeline_run_uuid,
        log_file.experiment_uuid,
    )

    return os.path.join(
        project_dir,
        _config.LOGS_PATH.format(pipeline_uuid=log_file.pipeline_uuid),
        "%s.log" % log_file.step_uuid,
    )


def clear_log_file(session_uuid):

    close_file_handle(session_uuid)
    try:
        del log_file_store[session_uuid]
    except Exception:
        logging.error("Key not in log_file_store: %s" % session_uuid)


def create_file_handle(log_file):

    log_path = get_log_path(log_file)

    try:
        file = open(log_path, "r")
        file.seek(0)
        file_handles[log_file.session_uuid] = file
        return True
    except IOError as ioe:
        logging.error(
            "Could not open log file for path %s. Error: %s" % (log_path, ioe)
        )

    return False


def close_file_handle(session_uuid):
    try:
        file_handles[session_uuid].close()
    except IOError as exc:
        logging.debug("Error closing log file %s" % exc)
    except Exception as e:
        logging.debug(
            "close_file_handle filed for session_uuid[%s] with error: %s"
            % (session_uuid, e)
        )


def main():

    logging.basicConfig(stream=sys.stdout, level=logging.INFO)

    logging.info("log_streamer started")

    # Connect to SocketIO server as client
    sio = socketio.Client()
    logging.getLogger("engineio").setLevel(logging.ERROR)

    sio.connect("http://localhost", namespaces=["/pty"])

    @sio.on("connect", namespace="/pty")
    def on_connect():
        logging.info("SocketIO connection established on namespace /pty")

    @sio.on("pty-log-manager-receiver", namespace="/pty")
    def process_log_manager(data):

        with lock:

            logging.info("EVENT on pty-log-manager-receiver: %s" % data)

            if data["action"] == "fetch-logs":

                logging.info(
                    "SocketIO action fetch-logs session_uuid %s" % data["session_uuid"]
                )

                log_file = LogFile(
                    data["session_uuid"],
                    data["pipeline_uuid"],
                    data["project_uuid"],
                    data["project_path"],
                    data["step_uuid"],
                )

                if "pipeline_run_uuid" in data:
                    log_file.pipeline_run_uuid = data["pipeline_run_uuid"]
                    log_file.experiment_uuid = data["experiment_uuid"]

                if data["session_uuid"] not in log_file_store:

                    if create_file_handle(log_file):
                        log_file_store[data["session_uuid"]] = log_file
                        logging.info(
                            "Added session_uuid (%s). Sessions active: %d"
                            % (data["session_uuid"], len(log_file_store))
                        )
                    else:
                        logging.error(
                            "Adding session_uuid (%s) failed." % data["session_uuid"]
                        )
                else:
                    logging.warn(
                        "Tried to add %s to log_file_store but it already exists."
                        % data["session_uuid"]
                    )

            elif data["action"] == "stop-logs":
                session_uuid = data["session_uuid"]
                if session_uuid in log_file_store.keys():
                    clear_log_file(session_uuid)
                    logging.info(
                        "Removed session_uuid (%s). Sessions active: %d"
                        % (session_uuid, len(log_file_store))
                    )
                else:
                    logging.error(
                        "Tried removing session_uuid (%s) which is not in log_file_store."
                        % session_uuid
                    )

            elif data["action"] == "heartbeat":

                session_uuid = data["session_uuid"]
                if session_uuid in log_file_store.keys():
                    logging.info("Received heartbeat for session %s" % session_uuid)
                    log_file_store[session_uuid].last_heartbeat = datetime.now()
                else:
                    logging.error(
                        "Received heartbeat for log_file with session_uuid %s that isn't registered."
                        % session_uuid
                    )

    # Initialize file reader loop
    file_reader_loop(sio)


if __name__ == "__main__":
    main()
