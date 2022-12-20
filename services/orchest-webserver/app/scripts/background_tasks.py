"""Module containing background tasks of the orchest-webserver.

The module runs as a short lived process which is created by the
orchest-webserver when a particular background task is needed. It does
not share it's codebase, thus re-using the existing models to interface
with the database through sqlalchemy is not possible.

Note: currently no tasks are defined.

"""
import argparse
from enum import Enum

import requests


class BackgroundTaskStatus(Enum):
    SUCCESS = 0
    PENDING = 1
    STARTED = 2
    FAILURE = 3


_tasks = {}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Launch background tasks.")
    parser.add_argument(
        "--type", required=True, type=str, help="type of background tasks"
    )
    parser.add_argument(
        "--uuid", required=True, type=str, help="uuid of the background task. "
    )
    parser.add_argument(
        "--url", required=False, type=str, help="A URL. Semantics depend on the task"
    )
    parser.add_argument(
        "--path",
        required=False,
        type=str,
        help="An absolute path. Semantics depend on the task",
    )

    args = parser.parse_args()

    PUT_ENDPOINT = " http://localhost/async/background-tasks"

    with requests.sessions.Session() as session:
        data = {"status": BackgroundTaskStatus.STARTED.name}
        url = f"{PUT_ENDPOINT}/{args.uuid}"
        session.put(url, json=data)

        try:
            task = _tasks[args.type]
            code, result = task(args)
        except Exception as e:
            code = 1
            result = f"Exception in task: {str(e)}"

        data = {
            "status": BackgroundTaskStatus.SUCCESS.name
            if code == 0
            else BackgroundTaskStatus.FAILURE.name,
            "code": str(code),
            "result": str(result),
        }
        session.put(url, json=data)
