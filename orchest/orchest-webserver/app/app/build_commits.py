import logging
import fcntl
import termios
import struct
import pty
import os
import subprocess
import select
import time

from flask import render_template, request, jsonify
from app.models import DataSource, Experiment, PipelineRun, Image, Commit
from _orchest.internals import config as _config

logging.basicConfig(level=logging.DEBUG)

def register_build_views(app, db, socketio):


    @socketio.on("resize", namespace="/pty")
    def resize(data):
        set_winsize(app.config["fd"], data["rows"], data["cols"])


    @socketio.on("connect", namespace="/pty")
    def connect():

        logging.info("socket.io client connected on /pty")

        # only start child process on boot once (hot reload may reinvoke this function)
        if "child_pid" in app.config:
            logging.info("only start child process on boot once (hot reload may reinvoke this function)")
            return

        # create single bash process to be used for all build actions
        (child_pid, fd) = pty.fork()

        cmd = ["bash", "-c", "while sleep 1; do date; done"]
        app.config["cmd"] = cmd

        logging.info(
            f"starting background task with command `{cmd}` to continously read "
            "and forward pty output to client"
        )

        if child_pid == 0:

            # disable logging in child pid
            logging.disable(logging.CRITICAL)
            
            subprocess.Popen(app.config["cmd"])

        else:
            logging.info("child pid is %d" % child_pid)

            app.config["fd"] = fd
            app.config["child_pid"] = child_pid
            set_winsize(fd, 50, 50)

            socketio.start_background_task(target=read_and_forward_pty_output)

            logging.info("task started")


    @app.route('/async/commits/build', methods=['POST'])
    def build_commit():

        return str(socketio)

    def set_winsize(fd, row, col, xpix=0, ypix=0):
        winsize = struct.pack("HHHH", row, col, xpix, ypix)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

    def read_and_forward_pty_output():
        logging.info("read_and_forward_pty_output fd: %d" % app.config["fd"])

        max_read_bytes = 1024 * 20
        while True:
            
            #logging.info("pre-sleep")
            socketio.sleep(0.001)
            #logging.info("post-sleep")
            if app.config["fd"]:
                timeout_sec = 0

                #logging.info("pre-select fd: %d" % app.config["fd"])
                (data_ready, _, _) = select.select(
                    [app.config["fd"]], [], [], timeout_sec)

                #logging.info("post-select")
                if data_ready:
                    output = os.read(app.config["fd"], max_read_bytes).decode()

                    #logging.info("output: %s" % output)

                    socketio.emit(
                        "pty-output", {"output": output}, namespace="/pty")

    
