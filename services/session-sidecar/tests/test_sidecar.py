import os
import shutil
import socket
import subprocess
import time
import uuid

import pytest


@pytest.fixture
def sidecar():
    abs_path = os.path.dirname(os.path.abspath(__file__))
    script = os.path.join(abs_path, "..", "app", "main.py")

    pipeline_uuid = str(uuid.uuid4())
    port = 1112
    project_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    logs_path = "logs"

    if os.path.isdir(project_dir):
        shutil.rmtree(project_dir)

    os.makedirs(project_dir, exist_ok=True)
    os.makedirs(os.path.join(project_dir, logs_path), exist_ok=True)

    command = [
        "python",
        "-u",
        script,
        "--project_dir",
        project_dir,
        "--logs_path",
        logs_path,
        "--port",
        str(port),
    ]
    proc = subprocess.Popen(
        command, env=dict(os.environ, ORCHEST_PIPELINE_UUID=pipeline_uuid)
    )

    # Allow the server the time to come online.
    time.sleep(0.5)

    settings = {
        "host": "localhost",
        "port": port,
        "pipeline_uuid": pipeline_uuid,
        "logs_path": logs_path,
        "project_dir": project_dir,
    }
    yield settings

    if proc.poll() is None:
        proc.kill()

    shutil.rmtree(project_dir)


def _inject_messages_as_user_service(ip, port, service, msgs):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((ip, port))
    for msg in msgs:
        # NOTE: the \n is to emulate what docker would do.
        aug_msg = f"user-service-{service}-metadata-end[0000]: {msg}\n"
        sock.send(aug_msg.encode("utf-8"))
    sock.close()


def _get_logs(project_dir, logs_path, service_name):
    path = os.path.join(project_dir, logs_path, f"{service_name}.log")

    with open(path, "r") as file:
        tmplines = file.readlines()
        lines = []
        for line in tmplines:
            if line[-1] == "\n":
                line = line[:-1]
            lines.append(line)

        # Will throw if it's not a valid uuid.
        uuid.UUID(lines[0])
        return lines[1:]


def test_correct_single_msg(sidecar):
    msg = "hello"
    _inject_messages_as_user_service(
        sidecar["host"], sidecar["port"], sidecar["pipeline_uuid"], [msg]
    )

    # Allow the server to write the file.
    time.sleep(0.2)
    logs = _get_logs(
        sidecar["project_dir"], sidecar["logs_path"], sidecar["pipeline_uuid"]
    )
    assert msg == logs[0]


def test_correct_multiple_messages(sidecar):
    msgs = [str(i) for i in range(10000)]
    _inject_messages_as_user_service(
        sidecar["host"], sidecar["port"], sidecar["pipeline_uuid"], msgs
    )

    # Allow the server to write the file.
    time.sleep(0.2)
    logs = _get_logs(
        sidecar["project_dir"], sidecar["logs_path"], sidecar["pipeline_uuid"]
    )
    assert msgs == logs


def test_new_connection_restarts_log(sidecar):
    """Simulate a new session starting.

    The log file should be reset if a service connects "again", i.e.
    the session has started anew.
    """
    msgs = [str(i) for i in range(5)]
    _inject_messages_as_user_service(
        sidecar["host"], sidecar["port"], sidecar["pipeline_uuid"], msgs
    )

    # Allow the server to write the file.
    time.sleep(0.2)
    logs = _get_logs(
        sidecar["project_dir"], sidecar["logs_path"], sidecar["pipeline_uuid"]
    )
    assert msgs == logs

    msgs = [str(10 + i) for i in range(5)]
    _inject_messages_as_user_service(
        sidecar["host"], sidecar["port"], sidecar["pipeline_uuid"], msgs
    )
    time.sleep(0.1)
    logs = _get_logs(
        sidecar["project_dir"], sidecar["logs_path"], sidecar["pipeline_uuid"]
    )
    assert msgs == logs


def test_malformed_missing_anchor(sidecar):
    """Test the log message not having the correct "anchor"."""
    msgs = [str(i) for i in range(5)]

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((sidecar["host"], sidecar["port"]))
    # First message to correctly identify the service.
    aug_msg = f'user-service-{sidecar["pipeline_uuid"]}-metadata-end[0000]: test\n'
    sock.send(aug_msg.encode("utf-8"))
    for msg in msgs:
        aug_msg = f'user-service-{sidecar["pipeline_uuid"]}-metadata-end: {msg}\n'
        sock.send(aug_msg.encode("utf-8"))
    sock.close()

    # Allow the server to write the file.
    time.sleep(0.2)
    logs = _get_logs(
        sidecar["project_dir"], sidecar["logs_path"], sidecar["pipeline_uuid"]
    )
    expected_logs = ["Malformed log message."] * len(msgs)
    assert ["test"] + expected_logs == logs
