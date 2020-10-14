#!/usr/bin/env python3

import socketio
import logging
import os

from _orchest.internals import config as _config


log_file_store = {}
file_handles = {}

class LogFile():

    def __init__(self, session_uuid, pipeline_uuid, step_uuid, pipeline_run_uuid = None, experiment_uuid = None):
        self.session_uuid = session_uuid
        self.pipeline_uuid = pipeline_uuid
        self.step_uuid = step_uuid
        self.pipeline_run_uuid = pipeline_run_uuid
        self.experiment_uuid = experiment_uuid


def file_reader_loop(sio):
    
    while True:

        # don't check files all the time
        all_files_at_end = True

        for session_uuid, _ in log_file_store.items():

            file = file_handles[session_uuid]
            
            if read_emit_all_lines(file, sio, session_uuid):
                all_files_at_end = False

        if all_files_at_end:
            sio.sleep(0.1)
            

def read_emit_all_lines(file, sio, session_uuid):

    has_emitted = False
    
    while True:
        line = file.readline()

        # readline returns the empty string if the end of the file has been reached
        if line != "":
            sio.emit("pty-log-manager", {
                "output": line,
                "action": "pty-broadcast",
                "session_uuid": session_uuid
            })
            has_emitted = True
        else:
            break

    return has_emitted


# TODO: reuse (between Flask app and process scripts) and simplify code to get the correct pipeline path
# There are currently two scenarios: a pipeline is in the userdir/pipelines or
# as a pipeline run in experiments.
def get_pipeline_dir(pipeline_uuid, pipeline_run_uuid=None, experiment_uuid=None):

    pipeline_dir_parts = ["/userdir"]
    
    if pipeline_run_uuid is not None and experiment_uuid is not None:
        pipeline_dir_parts += ["experiments", pipeline_uuid, experiment_uuid, pipeline_run_uuid]
    else:
        pipeline_dir_parts += ["pipelines", pipeline_uuid]

    return os.path.join(pipeline_dir_parts)


def create_file_handle(log_file):
    global file_handles

    pipeline_dir = get_pipeline_dir(log_file.pipeline_uuid, log_file.pipeline_run_uuid, log_file.experiment_uuid)

    log_path = os.path.join(
            pipeline_dir, _config.LOGS_PATH, "%s.log" % log_file.step_uuid)

    file_handles[log_file.session_uuid] = open(log_path, 'r')


def close_file_handle(session_uuid):
    global file_handles

    try:
        file_handles[session_uuid].close()
    except IOError as exc:
        logging.debug("Error closing log file %s" % exc)

            
def main():
    global file_store

    logging.info("log_streamer started")
    
    # Connect to SocketIO server as client
    sio = socketio.Client()

    sio.connect('http://localhost', namespaces=["/pty"])

    @sio.on("connect", namespace="/pty")
    def on_connect():
        logging.info("SocketIO connection established on namespace /pty")


    @sio.on("pty-log-manager", namespace="/pty")
    def process_log_manager(data):

        if data["action"] == "fetch-logs":
            
            log_file = LogFile(
                data["session_uuid"],
                data["pipeline_uuid"],
                data["step_uuid"],
            )

            if "pipeline_run_uuid" in data:
                log_file.pipeline_run_uuid = data["pipeline_run_uuid"]
                log_file.experiment_uuid = data["experiment_uuid"]

            log_file_store[data["session_uuid"]] = log_file

            create_file_handle(log_file)

            pass
        elif data["action"] == "stop-logs":
            pass

    
    # Initialize file reader loop
    file_reader_loop(sio)


if __name__ == "__main__":
    main()