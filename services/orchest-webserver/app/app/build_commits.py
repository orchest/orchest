import logging
import fcntl
import termios
import struct
import pty
import os
import subprocess
import select
import time
import docker
import tarfile
import io
import uuid
import json

from flask import render_template, request, jsonify
from app.models import DataSource, Experiment, PipelineRun, Image, Commit
from app.utils import tar_from_path


logging.basicConfig(level=logging.DEBUG)


def register_build_views(app, db, socketio):
    @app.route("/async/commits/build/<string:commit_uuid>", methods=["POST"])
    def build_commit(commit_uuid):

        commit = Commit.query.filter(Commit.uuid == commit_uuid).first()
        if commit is None:
            json_string = json.dumps(
                {
                    "success": False,
                    "reason": "Commit does not exist for UUID %s" % (commit_uuid),
                }
            )

            return json_string, 404, {"content-type": "application/json"}

        socketio.emit(
            "pty-build-manager",
            {
                "action": "start-build",
                "commit_uuid": commit.uuid,
                "commit_base_image": commit.base_image,
                "commit_tag": commit.tag,
                "user_dir": app.config["USER_DIR"],
                "rows": request.json.get("rows"),
                "cols": request.json.get("cols"),
            },
            namespace="/pty",
        )

        commit.building = True
        db.session.commit()

        return ""
