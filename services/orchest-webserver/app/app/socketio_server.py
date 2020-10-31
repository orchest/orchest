import logging
import os
from app.models import DataSource, Experiment, PipelineRun
from app.utils import project_uuid_to_path
from app.config import Config


def register_socketio_broadcast(db, socketio):
    @socketio.on("connect", namespace="/pty")
    def connect():
        logging.info("socket.io client connected on /pty")

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