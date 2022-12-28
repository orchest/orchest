"""Clones a git repo the parameters.

Script used by the pod in charge of pulling from git, exit codes:
- 1 -> GitCloneFailed
- 2 -> ProjectWithSameNameExists
- 3 -> ProjectNotDiscoveredByWebServer
- 4 -> NoAccessRightsOrRepoDoesNotExists
"""
import argparse
import os
import shlex
import subprocess
import sys
import time
from typing import Optional

import requests


def _git_clone_project(
    task_uuid: str, repo_url: str, project_name: str
) -> Optional[str]:

    try:

        # This way we clone in a directory with the name of the repo
        # if the project_name is not provided.
        # - GIT_TERMINAL_PROMPT makes the `git` command fail if it
        # has to prompt the user for input, e.g. for their username.
        git_command = f"git clone {repo_url}"
        if project_name is not None and project_name:
            git_command += f' "{project_name}"'

        print(f"Running {git_command}.")
        # Avoid collisions.
        tmp_path = f"/tmp/{task_uuid}/"
        os.mkdir(tmp_path)
        result = subprocess.run(
            shlex.split(git_command),
            cwd=tmp_path,
            env={**os.environ, **{"GIT_TERMINAL_PROMPT": "0"}},
            capture_output=True,
        )
        if result.returncode != 0:
            # Sadly git error codes aren't cleanly mapped.
            if (
                result.stderr is not None
                and "correct access rights" in result.stderr.decode().lower()
            ):
                sys.exit(4)
            sys.exit(1)

        # Should be the only directory in there, also this way we get
        # the directory without knowing the repo name if the
        # project_name has not been provided.
        inferred_project_name = os.listdir(tmp_path)[0]

        from_path = os.path.join(tmp_path, inferred_project_name)
        exit_code = os.system(f'mv "{from_path}" /userdir/projects/')
        if exit_code != 0:
            sys.exit(2)

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
            resp = requests.get("http://orchest-webserver/async/projects")
            if resp.status_code != 200:
                time.sleep(1)
                continue

            project = [
                proj for proj in resp.json() if proj["path"] == inferred_project_name
            ]
            if project or not os.path.exists(
                f"/userdir/projects/{inferred_project_name}"
            ):
                return project[0]["uuid"] if project else None
            time.sleep(1)

        sys.exit(3)

    # Cleanup the tmp directory in any case.
    finally:
        os.system(f'rm -rf "{tmp_path}"')


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--task-uuid", type=str, required=True)
    parser.add_argument("--repo-url", type=str, required=True)
    parser.add_argument("--project-name", type=str, default=None, required=False)
    args = parser.parse_args()
    project_uuid = _git_clone_project(
        task_uuid=args.task_uuid,
        repo_url=args.repo_url,
        project_name=args.project_name,
    )
    # This will be later parsed.
    print()
    print(project_uuid)
