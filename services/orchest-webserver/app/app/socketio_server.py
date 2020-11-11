import logging
import os

from app.models import DataSource, Experiment, PipelineRun
from app.utils import project_uuid_to_path
from app.config import Config
from flask import request
from collections import deque

from threading import Lock


def register_socketio_broadcast(db, socketio):

    # TODO: check whether its size will become a bottleneck
    environment_build_buffer = {}
    lock = Lock()

    @socketio.on("connect", namespace="/pty")
    def connect_pty():
        logging.info("socket.io client connected on /pty")

    @socketio.on("connect", namespace="/environment_builds")
    def connect_environment_builds():
        logging.info("socket.io client connected on /environment_builds")

        with lock:

            # send environment_build_buffers
            for key, value in environment_build_buffer.items():

                # send buffer to new client
                socketio.emit(
                    "sio_streamed_task_data",
                    {
                        "identity": key,
                        "output": "".join(value),
                        "action": "sio_streamed_task_output",
                    },
                    room=request.sid,
                    namespace="/environment_builds",
                )

    @socketio.on("sio_streamed_task_data", namespace="/environment_builds")
    def process_sio_streamed_task_data(data):

        with lock:

            if data["action"] == "sio_streamed_task_output":

                # initialize key for new identities
                if data["identity"] not in environment_build_buffer:
                    environment_build_buffer[data["identity"]] = deque(maxlen=100)

                environment_build_buffer[data["identity"]].append(data["output"])

                # broadcast streamed task message
                socketio.emit(
                    "sio_streamed_task_data",
                    data,
                    include_self=False,
                    namespace="/environment_builds",
                )

            elif data["action"] == "sio_streamed_task_started":

                try:
                    del environment_build_buffer[data["identity"]]
                except KeyError as e:
                    logging.error(
                        "Could not clear buffer for EnvironmentBuild with identity %s"
                        % data["identity"]
                    )

                # broadcast streamed task message
                socketio.emit(
                    "sio_streamed_task_data",
                    data,
                    include_self=False,
                    namespace="/environment_builds",
                )
            elif data["action"] == "sio_streamed_task_finished":

                socketio.emit(
                    "sio_streamed_task_data_finished_ack",
                    {},
                    room=request.sid,
                    namespace="/environment_builds",
                )

    @socketio.on("pty-log-manager", namespace="/pty")
    def process_log_manager(data):

        if data["action"] == "pty-broadcast":
            socketio.emit(
                "pty-output",
                {"output": data["output"], "session_uuid": data["session_uuid"]},
                namespace="/pty",
            )
        elif data["action"] == "pty-reset":
            socketio.emit(
                "pty-reset", {"session_uuid": data["session_uuid"]}, namespace="/pty"
            )
        else:
            # relay incoming message to pty-log-manager-receiver (log_streamer client)

            # for relay server side augmentation can happen for non-client data models (such as project path)
            if data["action"] == "fetch-logs":
                data["project_path"] = project_uuid_to_path(data["project_uuid"])

            socketio.emit("pty-log-manager-receiver", data, namespace="/pty")
