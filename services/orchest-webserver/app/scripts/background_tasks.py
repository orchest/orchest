"""Module containing background tasks of the orchest-webserver.

The module runs as a short lived process which is created by the
orchest-webserver when a particular background task is needed. It does
not share it's codebase, thus re-using the existing models to interface
with the database through sqlalchemy is not possible.

"""
import argparse
import os
import time
from enum import Enum
from typing import Tuple

import requests


class BackgroundTaskStatus(Enum):
    SUCCESS = 0
    PENDING = 1
    STARTED = 2
    FAILURE = 3


def git_clone_project(args) -> Tuple[int, str]:
    """Clone a git repo given a URL into the projects directory."""

    try:
        # Avoid collisions.
        tmp_path = f"/tmp/{args.uuid}/"
        os.mkdir(tmp_path)
        os.chdir(tmp_path)

        # This way we clone in a directory with the name of the repo if
        # the project_name is not provided.
        git_command = f"git clone {args.url}"

        # args.path contains the desired project name, if the user
        # specified it.
        project_name = args.path
        if project_name:
            if "/" in project_name:
                msg = "project name contains illegal character"
                raise Exception(msg)

            git_command += f' "{project_name}"'

        exit_code = os.system(git_command)
        if exit_code != 0:
            return exit_code, "git clone failed"

        # Should be the only directory in there, also this way we get
        # the directory without knowing the repo name if the
        # project_name has not been provided.
        inferred_project_name = os.listdir(tmp_path)[0]

        from_path = os.path.join(tmp_path, inferred_project_name)
        exit_code = os.system(f'mv "{from_path}" /userdir/projects/')
        if exit_code != 0:
            return exit_code, "project move failed"

        # Set correct group permission as git clone ignores setgid on
        # projects directory.
        projects_gid = os.stat("/userdir/projects").st_gid
        os.system(
            'chown -R :%s "%s"'
            % (
                projects_gid,
                os.path.join("/userdir/projects", inferred_project_name),
            )
        )

        # GETting the /async/projects endpoint triggers the discovering
        # of projects that have been created or deleted through the file
        # system, so that Orchest can re-sync projects.
        # The task is considered done once the project has been
        # discovered or if the project has been renamed/deleted (doesn't
        # exist anymore at the desired path.). The project not being
        # part of the projects returned by /async/projects is a rare
        # occurrence that can happen if a concurrent request is leading
        # to the discovery of the same project, which puts it in a
        # INITIALIZING status.
        for _ in range(5):
            resp = requests.get("http://localhost/async/projects")
            if resp.status_code != 200:
                time.sleep(1)
                continue

            project = [
                proj for proj in resp.json() if proj["path"] == inferred_project_name
            ]
            if project or not os.path.exists(
                f"/userdir/projects/{inferred_project_name}"
            ):
                return 0, inferred_project_name
            time.sleep(1)

        # Assume a failure after 5 attempts.
        return 1, "Project was not discovered by the webserver."

    except Exception as e:
        return 1, str(e)
    # Cleanup the tmp directory in any case.
    finally:
        os.system(f'rm -rf "{tmp_path}"')


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
