#!/usr/bin/env python3

import logging
import docker
import select
import os
import pty
import struct
import termios
import fcntl
import socketio

from ..app.utils import tar_from_path


fd_store = {}


def docker_build_commit(commit_uuid, commit_base_image, commit_tag, user_dir):

    print("[Build status] Image build started.", flush=True)

    shell_file_dir = os.path.join(user_dir, ".orchest", "commits", commit_uuid)
    shell_file_path = os.path.join(shell_file_dir, "shell.sh")

    if not os.path.isfile(shell_file_path):
        raise Exception("No file at bash_file_path location: %s" % shell_file_path)

    client = docker.from_env()

    # Create container from base image to run user shell script in (will run
    # Jupyter kernel - as that needs to be the default CMD for the committed
    # image to run correctly in conjunction with the Jupyter Enterprise
    # Gateway)
    
    container = client.containers.run(commit_base_image, ["/orchest/bootscript.sh"], 
        stdout=True, 
        stderr=True, 
        remove=True,
        detach=True,
        environment= {
            "KERNEL_ID": 0,
            "EG_RESPONSE_ADDRESS": "127.0.0.1",
        } # use dummy environment variables to make sure EG kernel starts
    )

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
    container.commit(commit_base_image, commit_tag)

    # shut down container
    container.kill()

    print("[Build status] Image build completed!", flush=True)
    print(chr(3), flush=True, end="")


def create_pty_fork(fork_lambda, commit_uuid, rows, cols):

    (child_pid, fd) = pty.fork()

    if child_pid == 0:

        # disable logging in child pid, to avoid socketio output in the stream
        logging.disable(logging.CRITICAL)
        
        fork_lambda()
        
    else:
        logging.info("child pid is %d" % child_pid)

        fd_store[commit_uuid] = fd

        logging.info("set fd_store = %s " % fd_store)

        set_winsize(fd, rows, cols)

        logging.info(
            "starting background task with command to continously read "
            "and forward pty output to client"
        )

        sio.start_background_task(target=read_and_forward_pty_output, fd=fd, commit_uuid=commit_uuid)

        logging.info("task started")


def stop_fd(fd):
        os.close(fd)
        logging.info("[Ended] read_and_forward_pty_output fd: %d" % fd)


def end_build_callback(fd, commit_uuid):
    stop_fd(fd)

    sio.emit(
        "pty-build-manager", 
        {"commit_uuid": commit_uuid, "action": "build-finished"}, 
        namespace="/pty")


def read_and_forward_pty_output(fd, commit_uuid):
        logging.info("[Started] read_and_forward_pty_output fd: %d" % fd)

        max_read_bytes = 1024 * 20

        while True:
        
            sio.sleep(0.01)
            #logging.info("post-sleep")

            #logging.info("pre-select fd: %d" % fd)
            (data_ready, _, _) = select.select(
                [fd], [], [], 0)
            #logging.info("post-select")

            if data_ready:
                try:
                    output = os.read(fd, max_read_bytes).decode()

                    #logging.info("output: %s" % output)
                    sio.emit( "pty-build-manager", {
                        "output": output, 
                        "commit_uuid": commit_uuid, 
                        "action": "pty-broadcast"}, namespace="/pty")

                    if len(output) > 0 and output[-1] == chr(3):
                        end_build_callback(fd, commit_uuid)
                        
                except:
                    end_build_callback(fd, commit_uuid)
                    break


def set_winsize(fd, row, col, xpix=0, ypix=0):

    logging.info("attempting resize of pty for fd %d to size (%d, %d)" % (
            fd,
            row,
            col))

    winsize = struct.pack("HHHH", row, col, xpix, ypix)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)


if __name__ == "__main__":
    
    # Connect to SocketIO server as client
    sio = socketio.Client()

    sio.connect('http://localhost', namespaces=["/pty"])

    @sio.on("connect", namespace="/pty")
    def on_connect():
        logging.info("SocketIO connection established on namespace /pty")


    @sio.on("pty-build-manager", namespace="/pty")
    def process_build_manager(data):

        if data["action"] == "start-build":

            fork_lambda = lambda: docker_build_commit(data["commit_uuid"], data["commit_base_image"], data["commit_tag"], data["user_dir"])

            create_pty_fork(fork_lambda, data["commit_uuid"], data["rows"], data["cols"])
            
        elif data["action"] == "resize":
            logging.info("attempting resize of pty for commit_uuid %s to size (%d, %d)" % (
                    data["commit_uuid"],
                    data["rows"],
                    data["cols"]))
                    
            set_winsize(fd_store[data["commit_uuid"]], data["rows"], data["cols"])