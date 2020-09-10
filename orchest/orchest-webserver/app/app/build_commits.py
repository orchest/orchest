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

    @socketio.on("resize", namespace="/pty")
    def resize(data):
        
        if app.config["fd"] and data["commit_uuid"] in app.config["fd"]:
            logging.info("attempting resize of pty for commit_uuid %s to size (%d, %d)" % (
                data["commit_uuid"],
                data["rows"],
                data["cols"]))
                
            set_winsize(app.config["fd"][data["commit_uuid"]], data["rows"], data["cols"])


    @socketio.on("connect", namespace="/pty")
    def connect():
        logging.info("socket.io client connected on /pty")


    @app.route("/async/commits/build/<string:commit_uuid>", methods=["POST"])
    def build_commit(commit_uuid):

        commit = Commit.query.filter(Commit.uuid == commit_uuid).first()
        if commit is None:
            json_string = json.dumps(
                {"success": False, "reason": "Commit does not exist for UUID %s" % (commit_uuid)})

            return json_string, 404, {"content-type": "application/json"}

        fork_lambda = lambda: docker_build_commit(commit)

        create_pty_fork(fork_lambda, commit_uuid, request.json.get('rows'), request.json.get('cols'))

        return ""


    def docker_build_commit(commit):

        print("Starting build", flush=True)

        shell_file_dir = os.path.join(app.config["USER_DIR"], ".orchest", "commits", commit.uuid)
        shell_file_path = os.path.join(shell_file_dir, "shell.sh")

        if not os.path.isfile(shell_file_path):
            raise Exception("No file at bash_file_path location: %s" % shell_file_path)

        client = docker.from_env()

        # create container from base image to run user shell script in
        container = client.containers.run(commit.base_image, ["/orchest/bootscript.sh", "idle"], 
            stdout=True, 
            stderr=True, 
            remove=True,
            detach=True)

        # bash file name
        shell_file_name = os.path.basename(shell_file_path)
        
        # copy user bash file to instance
        try:
            data = tar_from_path(shell_file_path, shell_file_name)
            container.put_archive("/", data)

        except Exception as e:
            print(e, flush=True)

        exec_result = container.exec_run(["bash", os.path.join("/", shell_file_name)], stdout=True, stderr=True, stream=True, workdir="/")

        for output in exec_result.output:
            print(output.decode(), flush=True, end='')

        # create image commit
        container.commit(commit.base_image, commit.tag)

        # shut down container
        container.kill()

        print("Building commit complete!", flush=True)
        print(chr(3), flush=True, end="")

        time.sleep(0.5)


    def create_pty_fork(fork_lambda, commit_uuid, rows, cols):

        (child_pid, fd) = pty.fork()

        fd_config = app.config.get("fd", {})
        fd_config[commit_uuid] = fd

        if child_pid == 0:

            # disable logging in child pid, to avoid socketio output in the stream
            logging.disable(logging.CRITICAL)
            
            fork_lambda()
            
        else:
            logging.info("child pid is %d" % child_pid)

            set_winsize(fd, rows, cols)

            logging.info(
                "starting background task with command to continously read "
                "and forward pty output to client"
            )

            socketio.start_background_task(target=read_and_forward_pty_output, fd=fd, commit_uuid=commit_uuid)

            logging.info("task started")


    def set_winsize(fd, row, col, xpix=0, ypix=0):

        logging.info("attempting resize of pty for fd %d to size (%d, %d)" % (
                fd,
                row,
                col))

        winsize = struct.pack("HHHH", row, col, xpix, ypix)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)


    def stop_fd(fd):
        # TODO: check whether the pty is discarded on os.close, might be running
        # due to Flask/Socketio keep alive background tasks
        os.close(fd)
        logging.info("[Ended] read_and_forward_pty_output fd: %d" % fd)


    def read_and_forward_pty_output(fd, commit_uuid):
        logging.info("[Started] read_and_forward_pty_output fd: %d" % fd)

        max_read_bytes = 1024 * 20

        while True:
        
            socketio.sleep(0.01)
            #logging.info("post-sleep")

            #logging.info("pre-select fd: %d" % fd)
            (data_ready, _, _) = select.select(
                [fd], [], [], 0)
            #logging.info("post-select")

            if data_ready:
                try:
                    output = os.read(fd, max_read_bytes).decode()

                    #logging.info("output: %s" % output)
                    socketio.emit(
                        "pty-output", 
                        {"output": output, "commit_uuid": commit_uuid}, 
                        namespace="/pty")

                    if len(output) > 0 and output[-1] == chr(3):
                        stop_fd(fd)
                        
                except:
                    stop_fd(fd)
                    break