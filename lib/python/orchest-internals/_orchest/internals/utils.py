import json
import logging
import os
import re
import time
import uuid
from collections import ChainMap, abc
from copy import deepcopy
from typing import Any, Dict, Optional, Tuple

import docker
import requests
from docker.types import DeviceRequest

from _orchest.internals import config as _config
from _orchest.internals import errors as _errors

logger = logging.getLogger(__name__)


class GlobalOrchestConfig:
    # Configurations at the application level.
    _cloud = _config.CLOUD

    # Class specific configurations.
    _path = "/config/config.json"

    # Defines default values for all supported configuration options.
    _default_values = {
        "MAX_JOB_RUNS_PARALLELISM": 1,
        "MAX_INTERACTIVE_RUNS_PARALLELISM": 1,
        "AUTH_ENABLED": False,
        "TELEMETRY_DISABLED": False,
        "TELEMETRY_UUID": str(uuid.uuid4()),
        "INTERCOM_USER_EMAIL": "johndoe@example.org",
    }
    _cloud_unmodifiable_config_values = [
        "TELEMETRY_UUID",
        "TELEMETRY_DISABLED",
        "AUTH_ENABLED",
        "INTERCOM_USER_EMAIL",
    ]

    def __init__(self) -> None:
        """Manages the global user config.

        Uses a collections.ChainMap under the hood to provide fallback
        to default values where needed. And when running with `--cloud`,
        it won't allow you to update config values of the keys defined
        in `self._cloud_unmodifiable_config_values`.

        Raises:
            CorruptedFileError: The global user config file is
                corrupted.

        Example:
            >>> config = GlobalOrchestConfig()
            >>> # Save the validated config to a flask app config.
            >>> config.save(flask_app=app)
            >>> # Set the current config to a new one.
            >>> config.set(new_config)
            >>> # Save the updated (and automatically validated) config.
            >>> config.save(flask_app=app)

        """
        unmodifiable_config, self._config = self._get_current_configs()
        self._values = ChainMap(unmodifiable_config, self._config, self._default_values)

    def get(self) -> dict:
        # Flatten into regular dictionary.
        return dict(self._values)

    def save(self, flask_app=None) -> None:
        """Saves the state to disk.

        Optionally also saves to the `flask_app.config`.

        Args:
            flask_app (flask.Flask): Flask application to save the state
                to.

        """
        state = self.get()
        with open(self._path, "w") as f:
            json.dump(state, f)

        # Save to the flask_app config after the disk save has succeeded
        # to make sure the flask_app does not have configuration values
        # that are not persisted.
        if flask_app is not None:
            flask_app.config.update(state)

    def update(self, d: dict) -> None:
        """Updates the current config values.

        Under the hood it just calls `dict.update` on the current config
        dict.

        Raises:
            TypeError: The values of the dictionary that correspond to
                supported config values have incorrect types.
            ValueError: The values of the dictionary that correspond to
                supported config values have incorrect values. E.g.
                maximum parallelism has to be greater or equal to one.

        """
        try:
            self._validate_dict(d)
        except (TypeError, ValueError) as e:
            logger.error(
                "Tried to update global Orchest config with incorrect types or values."
            )
            raise e
        else:
            self._config.update(d)

    def set(self, d: dict) -> None:
        """Overwrites the current config with the given dict.

        Raises:
            TypeError: The values of the dictionary that correspond to
                supported config values have incorrect types.
            ValueError: The values of the dictionary that correspond to
                supported config values have incorrect values. E.g.
                maximum parallelism has to be greater or equal to one.

        """
        try:
            self._validate_dict(d)
        except (TypeError, ValueError) as e:
            logger.error(
                "Tried to update global Orchest config with incorrect types or values."
            )
            raise e
        else:
            self._config = d
            self._values.maps[1] = self._config

    def __getitem__(self, key):
        return self._values[key]

    def _validate_dict(self, d: abc.Mapping) -> None:
        """Validates the types and values of the values of the dict.

        Note:
            Keys in the given dict that are not in the
            `self._default_values` are not checked.

        Returns:
            `True` if the types of the values of the given dict equal
            the types of the respective key's values of the
            `self._default_values` and specific rules are satisfied,
            e.g. parallelism > 0.
            `False` otherwise.

        """
        # Check for types.
        for k, val in self._default_values.items():
            try:
                if not isinstance(d[k], type(val)):
                    raise TypeError(
                        "Given dictionary has uncompatible types for certain values."
                    )
            except KeyError:
                # We let it pass silently because it won't break the
                # application in any way.
                logger.debug(
                    "User tried to add a config value that is not used by Orchest."
                )

        # Check for values.
        max_job_runs_parallelism = d.get("MAX_JOB_RUNS_PARALLELISM")
        if max_job_runs_parallelism is not None and max_job_runs_parallelism <= 0:
            raise ValueError(
                "MAX_JOB_RUNS_PARALLELISM has to be strictly larger than zero."
            )

        max_interactive_runs_parallelism = d.get("MAX_INTERACTIVE_RUNS_PARALLELISM")
        if (
            max_interactive_runs_parallelism is not None
            and max_interactive_runs_parallelism <= 0
        ):
            raise ValueError(
                "MAX_INTERACTIVE_RUNS_PARALLELISM has to be strictly larger than zero."
            )

    def _get_current_configs(self) -> Tuple[dict, dict]:
        """Gets the dicts needed to initialize this class.

        Returns:
            (unmodifiable_config, current_config): The first being
                populated in case `self._cloud==True` and taking the
                values of the respective `current_config` values.

        """
        current_config = self.read_raw_current_config()

        try:
            self._validate_dict(current_config)
        except (TypeError, ValueError):
            raise _errors.CorruptedFileError(
                f'The values defined in the global user config ("{self._path}") have'
                + " incorrect types or values."
            )

        unmodifiable_config = {}
        if self._cloud:
            for k in self._cloud_unmodifiable_config_values:
                try:
                    unmodifiable_config[k] = deepcopy(current_config[k])
                except KeyError:
                    # Otherwise you could get a default value of
                    # `AUTH_ENABLED` being `False`. This is probably not
                    # what you want.
                    raise _errors.CorruptedFileError(
                        "When running Orchest with '--cloud' all of"
                        f" {self._cloud_unmodifiable_config_values} have to be defined."
                    )

        return unmodifiable_config, current_config

    def read_raw_current_config(self) -> dict:
        """Purely reads the current config without any editing.

        Raises:
            CorruptedFileError: Could not decode config file.

        """
        try:
            with open(self._path, "r") as f:
                return json.load(f)
        except FileNotFoundError:
            logger.warning("Global user config file did not exist.", exc_info=True)
            return {}
        except json.JSONDecodeError as e:
            logger.debug(e, exc_info=True)

            # NOTE: It can not pass silenty because then we might write
            # to the file later on, overwriting existing values. This
            # could break the Telemetry.
            raise _errors.CorruptedFileError(
                f'Could not decode global user config file ("{self._path}").'
            )


def get_mount(source, target, form="docker-sdk"):
    if form == "docker-sdk":
        return {source: {"bind": target, "mode": "rw"}}
    elif form == "docker-engine":
        return f"{source}:{target}"


def run_orchest_ctl(client, command):

    return client.containers.run(
        "orchest/orchest-ctl:latest",
        command,
        name="orchest-ctl-" + str(uuid.uuid4()),
        detach=True,
        auto_remove=True,
        mounts=[
            docker.types.Mount(
                source="/var/run/docker.sock",
                target="/var/run/docker.sock",
                type="bind",
            ),
            docker.types.Mount(
                source=os.environ.get("HOST_REPO_DIR"),
                target="/orchest-host",
                type="bind",
            ),
            docker.types.Mount(
                source=os.environ.get("HOST_CONFIG_DIR"),
                target="/config",
                type="bind",
            ),
        ],
        environment={
            "HOST_CONFIG_DIR": os.environ.get("HOST_CONFIG_DIR"),
            "HOST_REPO_DIR": os.environ.get("HOST_REPO_DIR"),
            "HOST_USER_DIR": os.environ.get("HOST_USER_DIR"),
            "HOST_OS": os.environ.get("HOST_OS"),
        },
    )


def get_device_requests(environment_uuid, project_uuid, form="docker-sdk"):

    device_requests = []

    capabilities = get_environment_capabilities(environment_uuid, project_uuid)

    # Do not request GPU capabilities if the instance can't support it,
    # it will result in an error.
    if not _config.GPU_ENABLED_INSTANCE:
        capabilities = [
            c for c in capabilities if c not in ["gpu", "utility", "compute"]
        ]

    if len(capabilities) > 0:

        if form == "docker-sdk":
            device_requests.append(DeviceRequest(count=-1, capabilities=[capabilities]))
        elif form == "docker-engine":
            device_requests.append(
                {"Driver": "nvidia", "Count": -1, "Capabilities": [capabilities]}
            )

    return device_requests


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


def get_orchest_mounts(
    project_dir,
    pipeline_file,
    host_user_dir,
    host_project_dir,
    host_pipeline_file,
    mount_form="docker-sdk",
):
    """
    Prepare all mounts that are needed to run Orchest.

    Args:
        mount_form: One of "docker-sdk" or "docker-engine". The former
            is used for the "docker-py" package and the latter for
            "aiodocker".

    """

    project_dir_mount = get_mount(
        source=host_project_dir, target=project_dir, form=mount_form
    )

    if mount_form == "docker-sdk":
        mounts = project_dir_mount
    else:
        mounts = [project_dir_mount]

    # Mount the pipeline file to a specific path.
    pipeline_file_mount = get_mount(
        source=host_pipeline_file, target=pipeline_file, form=mount_form
    )

    if mount_form == "docker-sdk":
        mounts[host_pipeline_file] = pipeline_file_mount[host_pipeline_file]
    else:
        mounts.append(pipeline_file_mount)

    # Mount the /userdir/data directory.
    target_path = "/data"
    source = os.path.join(host_user_dir, "data")

    mount = get_mount(
        source=source,
        target=target_path,
        form=mount_form,
    )

    if mount_form == "docker-sdk":
        mounts[source] = mount[source]
    else:
        mounts.append(mount)

    return mounts


def docker_images_list_safe(docker_client, *args, attempt_count=10, **kwargs):

    for _ in range(attempt_count):
        try:
            return docker_client.images.list(*args, **kwargs)
        except docker.errors.ImageNotFound as e:
            logging.debug(
                "Internal race condition triggered in docker_client.images.list(): %s"
                % e
            )
        except Exception as e:
            logging.debug("Failed to call docker_client.images.list(): %s" % e)
            return None


def is_werkzeug_parent():
    # When Flask is running in dev mode, Werkzeug
    # starts a parent and child process to support hot reloading.

    # For code that needs to run non-concurrently we use this gate
    # to avoid concurrent exection.
    if os.environ.get("FLASK_ENV") != "development":
        return False
    elif os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        return True


def docker_images_rm_safe(docker_client, *args, attempt_count=10, **kwargs):

    for _ in range(attempt_count):
        try:
            return docker_client.images.remove(*args, **kwargs)
        except docker.errors.ImageNotFound as e:
            logging.debug("Failed to remove image: %s" % e)
            return
        except Exception as e:
            logging.debug("Failed to remove image: %s" % e)
        time.sleep(1)


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
        and isinstance(service.get("preserve_base_path", False), bool)
        and
        # Allowed scopes.
        all([sc in ["interactive", "noninteractive"] for sc in service["scope"]])
        and isinstance(service.get("command", ""), str)
        and isinstance(service.get("entrypoint", ""), str)
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
        and isinstance(service.get("ports", []), list)
        and all([isinstance(port, int) for port in service.get("ports", [])])
        and isinstance(service.get("env_variables_inherit", []), list)
        and all(
            [
                is_env_var_name_valid(var)
                for var in service.get("env_variables_inherit", [])
            ]
        )
        and are_environment_variables_valid(service.get("env_variables", {}))
    )


def is_services_definition_valid(services: Dict[str, Dict[str, Any]]) -> bool:
    return isinstance(services, dict) and all(
        [
            is_service_definition_valid(service) and sname == service["name"]
            for sname, service in services.items()
        ]
    )


def docker_has_gpu_capabilities(
    client: Optional[docker.client.DockerClient] = None,
) -> bool:
    """Checks if GPU capabilities can be requested for containers."""

    if client is None:
        client = docker.client.DockerClient.from_env()

    other_container_args = {}
    other_container_args["remove"] = True
    other_container_args["command"] = "bash"
    other_container_args["name"] = f"orchest-gpu-test-{str(uuid.uuid1())}"
    device_requests = []
    capabilities = ["gpu", "utility", "compute"]
    device_requests.append(DeviceRequest(count=-1, capabilities=[capabilities]))
    try:
        client.containers.run(
            "python:3.8-slim",
            device_requests=device_requests,
            **other_container_args,
        )
    except docker.errors.APIError:
        # If the error is caused by the device driver "nvidia" not being
        # there the container will not be auto removed.
        try:
            c = client.containers.get(other_container_args["name"])
            c.remove(force=True)
        except (docker.errors.NotFound, docker.errors.APIError):
            pass
        return False
    return True
