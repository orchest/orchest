import argparse
from enum import Enum
import os
import requests
import uuid


class BackgroundTaskStatus(Enum):
    SUCCESS = 0
    PENDING = 1
    STARTED = 2
    FAILURE = 3


def git_clone_project(args):
    """Clone a git repo given a URL into the projects directory.

    """
    url = args.url
    project_name = args.path

    # avoid collision
    tmp_path = f"/tmp/{str(uuid.uuid4())}/"
    os.mkdir(tmp_path)

    try:
        os.chdir(tmp_path)
        exit_code = os.system(f"git clone {url}")
        msg = "successfully cloned"
        if exit_code != 0:
            msg = "git clone failed"
        else:
            res = os.listdir(tmp_path)
            from_path = os.path.join(tmp_path, res[0])
            if project_name:
                to_path = f"/userdir/projects/{project_name}"
                if not os.path.exists(to_path):
                    exit_code = os.system(f"mv {from_path} {to_path}")
                else:
                    exit_code = 1
            else:
                exit_code = os.system(f"mv {from_path} /userdir/projects/")

            if exit_code != 0:
                msg = "project move failed"
    # cleanup the tmp directory in any case
    finally:
        os.system(f"rm -rf {tmp_path}")

    return exit_code, msg


_tasks = {"git_clone_project": git_clone_project}

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
