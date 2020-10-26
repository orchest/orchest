import logging
import os
from app.models import DataSource, Experiment, PipelineRun, Image, Commit
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

    @socketio.on("pty-build-manager", namespace="/pty")
    def process_build_manager(data):

        if data["action"] == "build-finished":

            commit = Commit.query.filter(Commit.uuid == data["commit_uuid"]).first()

            if commit is not None:

                commit.building = False
                db.session.commit()

                socketio.emit(
                    "pty-signals",
                    {"action": "build-ready", "commit_uuid": commit.uuid},
                    namespace="/pty",
                )
            else:
                logging.info(
                    "Tried to announce build finished SocketIO event for non-existing Commit with uuid: %s"
                    % data["commit_uuid"]
                )

        elif data["action"] == "pty-broadcast":
            socketio.emit(
                "pty-output",
                {"output": data["output"], "commit_uuid": data["commit_uuid"]},
                namespace="/pty",
            )

    @socketio.on("resize", namespace="/pty")
    def resize(data):

        logging.info(
            "message passing resize of pty for commit_uuid %s to size (%d, %d)"
            % (data["commit_uuid"], data["rows"], data["cols"])
        )

        socketio.emit(
            "pty-build-manager",
            {
                "action": "resize",
                "commit_uuid": data["commit_uuid"],
                "rows": data["rows"],
                "cols": data["cols"],
            },
            namespace="/pty",
        )
