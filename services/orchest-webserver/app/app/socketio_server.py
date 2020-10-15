import logging


def register_socketio_broadcast(socketio):

    @socketio.on("pty-build-manager", namespace="/pty")
    def process_build_manager(data):

        if data["action"] == "pty-broadcast":
            socketio.emit(
                "pty-output", 
                {"output": data["output"], "commit_uuid": data["commit_uuid"]}, 
                namespace="/pty")


    @socketio.on("pty-log-manager", namespace="/pty")
    def process_log_manager(data):

        if data["action"] == "pty-broadcast":
            socketio.emit(
                "pty-output", 
                {"output": data["output"], "session_uuid": data["session_uuid"]}, 
                namespace="/pty")
        elif data["action"] == "pty-reset":
            socketio.emit(
                "pty-reset", 
                {"session_uuid": data["session_uuid"]}, 
                namespace="/pty")
        else:
            # relay incoming message to pty-log-manager-receiver (log_streamer client)
            socketio.emit("pty-log-manager-receiver", data, namespace="/pty")