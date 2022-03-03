import logging
import os

from flask import jsonify, request

from app.config import CONFIG_CLASS


def register_views(app):
    @app.route("/update-sidecar/heartbeat", methods=["GET"])
    def heartbeat():
        return {}, 200

    @app.route("/update-sidecar/update-status", methods=["GET"])
    def update_status():
        if request.args.get("token") != CONFIG_CLASS.TOKEN:
            return "", 403

        try:
            updating = True
            if os.path.exists(CONFIG_CLASS.UPDATE_COMPLETE_FILE):
                try:
                    updating = False
                    os.remove(CONFIG_CLASS.UPDATE_COMPLETE_FILE)
                except Exception as e:
                    logging.error("Failed to clear update complete file.")
                    logging.error(e)

            with open(CONFIG_CLASS.UPDATE_FILE_LOG, "r") as f:
                content = f.read()

            return jsonify({"updating": updating, "update_output": content}), 200

        except Exception:
            return "Could not check update status.", 500
