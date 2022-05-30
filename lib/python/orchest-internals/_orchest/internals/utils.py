from __future__ import annotations

import logging
import os
import re
import subprocess
from typing import Any, Dict, List, Set, Tuple

import requests
from werkzeug.serving import is_running_from_reloader as _irfr

logger = logging.getLogger(__name__)


def get_environment_capabilities(environment_uuid, project_uuid):

    capabilities = []

    try:
        response = requests.get(
            "http://orchest-webserver/store/environments/%s/%s"
            % (project_uuid, environment_uuid)
        )
        response.raise_for_status()
    except Exception as e:
        logging.error(
            (
                "Failed to get environment for environment_uuid[%s]"
                " and project_uuid[%s]. Error: %s (%s)"
            )
            % (environment_uuid, project_uuid, e, type(e))
        )
        return capabilities

    environment = response.json()

    if environment.get("gpu_support"):
        capabilities += ["gpu", "utility", "compute"]

    return capabilities


def get_step_and_kernel_volumes_and_volume_mounts(
    userdir_pvc: str,
    project_dir: str,
    pipeline_file: str,
    container_project_dir: str,
    container_pipeline_file: str,
) -> Tuple[List[dict], List[dict]]:
    """Gets volumes and volume mounts required to run steps and kernels.

    Args:
        userdir_pvc:
        project_dir:
        pipeline_file:
        container_project_dir:
        container_pipeline_file:

    Returns:
        A pair of lists, the first element is a list of volumes, the
        second a list of volume_mounts, valid in k8s pod manifest. The
        two lists are coupled, each volume mount is related to a volume.
    """
    volumes = []
    volume_mounts = []

    relative_project_dir = get_userdir_relpath(project_dir)
    relative_pipeline_path = os.path.join(relative_project_dir, pipeline_file)

    volumes.append(
        {
            "name": "userdir-pvc",
            "persistentVolumeClaim": {"claimName": userdir_pvc, "readOnly": False},
        }
    )

    volume_mounts.append(
        {"name": "userdir-pvc", "mountPath": "/data", "subPath": "data"}
    )
    volume_mounts.append(
        {
            "name": "userdir-pvc",
            "mountPath": "/userdir/projects",
            "subPath": "projects",
        }
    )
    volume_mounts.append(
        {
            "name": "userdir-pvc",
            "mountPath": container_project_dir,
            "subPath": relative_project_dir,
        }
    )
    volume_mounts.append(
        {
            "name": "userdir-pvc",
            "mountPath": container_pipeline_file,
            "subPath": relative_pipeline_path,
        }
    )

    return volumes, volume_mounts


def is_running_from_reloader():
    """Is this thread running from a werkzeug reloader.

    When Flask is running in development mode, the application is
    first initialized and then restarted again in a child process. This
    means that code will run (concurrently) again inside the reloader,
    which can case issues with code that should only run once.

    By using this gate, we can prevent from rerunning certain code in
    the child process.

    """
    return _irfr()


def are_environment_variables_valid(env_variables: Dict[str, str]) -> bool:
    return isinstance(env_variables, dict) and all(
        [
            is_env_var_name_valid(var) and isinstance(value, str)
            for var, value in env_variables.items()
        ]
    )


def is_env_var_name_valid(name: str) -> bool:
    # Needs to be kept in sync with the FE.
    return isinstance(name, str) and re.match(r"^[0-9a-zA-Z\-_]+$", name)


def make_env_var_name_valid(name: str) -> str:
    return re.sub("[^0-9a-zA-Z\-_]", "_", name)


def is_service_name_valid(service_name: str) -> bool:
    # NOTE: this is enforced at the GUI level as well, needs to be kept
    # in sync.
    return bool(re.match(r"^[0-9a-zA-Z\-]{1,36}$", service_name))


def is_service_definition_valid(service: Dict[str, Any]) -> bool:
    return (
        isinstance(service, dict)
        and is_service_name_valid(service["name"])
        and isinstance(service["image"], str)
        and service["image"]
        and isinstance(service["scope"], list)
        and isinstance(service.get("order"), int)
        and isinstance(service.get("preserve_base_path", False), bool)
        and
        # Allowed scopes.
        all([sc in ["interactive", "noninteractive"] for sc in service["scope"]])
        and isinstance(service.get("command", ""), str)
        and isinstance(service.get("args", ""), str)
        and isinstance(service.get("binds", {}), dict)
        and all(
            [
                isinstance(s, str) and isinstance(t, str) and s and t
                for s, t in service.get("binds", {}).items()
            ]
        )
        and
        # Allowed binds.
        all([bind in ["/data", "/project-dir"] for bind in service.get("binds", {})])
        and isinstance(service.get("ports"), list)
        and all([isinstance(port, int) for port in service["ports"]])
        and len(service["ports"]) > 0
        and isinstance(service.get("env_variables_inherit", []), list)
        and all(
            [
                is_env_var_name_valid(var)
                for var in service.get("env_variables_inherit", [])
            ]
        )
        and are_environment_variables_valid(service.get("env_variables", {}))
        and isinstance(service.get("exposed"), bool)
        and isinstance(service.get("requires_authentication", True), bool)
    )


def is_services_definition_valid(services: Dict[str, Dict[str, Any]]) -> bool:
    if not isinstance(services, dict):
        return False

    existing_orders: Set[int] = set()

    for sname, service in services.items():
        if (
            not is_service_definition_valid(service)
            or sname != service["name"]
            or service["order"] in existing_orders
        ):
            return False

        existing_orders.add(service["order"])

    return True


def rmtree(path, ignore_errors=False) -> None:
    """A wrapped rm -rf.

    If eventlet is being used and it's either patching all modules or
    patchng subprocess, this function is not going to block the thread.

    Raises:
        OSError if it failed to copy.

    """
    exit_code = subprocess.call(["rm", "-rf", path], stderr=subprocess.STDOUT)
    if exit_code != 0 and not ignore_errors:
        raise OSError(f"Failed to rm {path}: {exit_code}.")


def copytree(
    source: str, target: str, ignore_errors: bool = False, use_gitignore: bool = False
) -> None:
    """Copies content from source to target.

    If eventlet is being used and it's either patching all modules or
    patching subprocess, this function is not going to block the thread.

    Args:
        source:
        target:
        ignore_errors: If True errors will be ignored, if False an
            OSError will be raised.
        use_gitignore: If True, the copying process will ignore patterns
            from the top-level `.gitignore` in `source`.

    Raises:
        OSError if it failed to copy and ignore_errors is True.

    """

    if use_gitignore:

        # With a trailing `/` rsync copies the content of the directory
        # instead of the directory itself.
        if not source.endswith("/"):
            source += "/"

        # Using rsync with `-W` copies files as a whole which
        # drastically improves its performance, making it almost as fast
        # as the `cp` command. The other options (`-aHAX`) are to
        # preserve all kinds of attributes, e.g. symlinks, `-a` also
        # automatically copies recursively.
        copy_cmd = ["rsync", "-aWHAX"]
        if os.path.isfile(f"{source}.gitignore"):  # source has trailing `/`
            copy_cmd += [f"--exclude-from={source}.gitignore"]
        # TODO: use shlex to handle this properly.
        copy_cmd += [source, target]
    else:
        copy_cmd = ["cp", "-r", source, target]

    exit_code = subprocess.call(copy_cmd, stderr=subprocess.STDOUT)
    if exit_code != 0 and not ignore_errors:
        raise OSError(f"Failed to copy {source} to {target}, :{exit_code}.")


def get_userdir_relpath(path):
    return os.path.relpath(path, "/userdir")


def _is_calver_version(version: str) -> bool:
    try:
        year, month, patch = version.split(".")
        if (
            not year.startswith("v")
            or len(year) != 5
            or len(month) != 2
            or len(patch) == 0
        ):
            raise

        int(year[1:]), int(month), int(patch)
    except Exception:
        return False

    return True


def is_version_lt(expected_older: str, expected_newer: str) -> bool:
    """Returns `old < new`, i.e. less than.

    In other words, returns whether `expected_newer` is a newer version
    than `expected_older`.

    Raises:
        ValueError: If `expected_older` or `expected_newer` does not
            follow our CalVer versioning scheme.

    """
    if not _is_calver_version(expected_older):
        raise ValueError(
            f"The given version '{expected_older}' does not follow"
            " CalVer versioning, e.g. 'v2022.02.4'."
        )
    elif not _is_calver_version(expected_newer):
        raise ValueError(
            f"The given version '{expected_newer}' does not follow"
            " CalVer versioning, e.g. 'v2022.02.4'."
        )

    expected_older, expected_newer = expected_older[1:], expected_newer[1:]
    for o, n in zip(expected_older.split("."), expected_newer.split(".")):
        if int(o) > int(n):
            return False
        elif int(o) < int(n):
            return True
    return False
