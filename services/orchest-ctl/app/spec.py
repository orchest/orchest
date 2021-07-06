"""Manages the container configurations / specs."""

import os
from collections.abc import Container
from enum import Enum
from typing import Dict, Optional

from _orchest.internals import config as _config
from app import utils


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


def inject_dict(self, other: dict, overwrite: bool = True) -> None:
    """Recursively injects (in-place) another dict into self.

    In contrast to ``dict.update()`` this method recurses into
    nested dictionaries updating the values.

    Note:
        Modified `self` in-place.

    Args:
        other: The other dict to inject into self.
        overwrite: If True then values are overwritten on key
            collision and otherwise they are added (using ``+``) for
            lists only.

    Example:
        >>> d = {"key": ["value"]}
        >>> d.inject({"key", ["another"]}, overwrite=True)
        ... {"key": ["value"]}
        >>> d.inject({"key", ["another"]}, overwrite=False)
        ... {"key": ["value", "another"]}

    """
    for name, config in other.items():
        if name in self and isinstance(self[name], dict) and isinstance(config, dict):
            inject_dict(self[name], config, overwrite=overwrite)
        elif (
            not overwrite
            and name in self
            and isinstance(self[name], list)
            and isinstance(config, list)
        ):
            self[name] += config
        else:
            self[name] = config


def filter_container_config(
    container_config: dict, filter: Dict[str, Container]
) -> dict:
    """Filter the given container config based on a filter.

    Note:
        The filter is only applied to second-level keys, i.e. the keys
        right after the top-level keys.

    Example:
        >>> filter = {"Image": ["orchest/orchest-api:latest"]}
        >>> config = {
        ...     "orchest-api": {
        ...         "Image": "orchest/orchest-api:latest",
        ...         ...
        ...     },
        ...     "orchest-webserver": {
        ...         "Image": "orchest/orchest-webserver:latest",
        ...         ...
        ...     }
        ... }
        >>> filter_container_config(config, filter)
        ... {
        ...     "orchest-api": {
        ...         "Image": "orchest/orchest-api:latest",
        ...         ...
        ...     },
        ... }

    Returns:
        A copy of the dictionary corresponding to the filtered original.
        Whereas the original is not modified!

    """
    res = {}
    for key, valid_options in filter.items():
        for name, config in container_config.items():
            if config.get(key) is not None and config[key] in valid_options:
                res[name] = config

    return res


def get_container_config(
    port: int = 8000,
    cloud: bool = False,
    dev: bool = False,
    log_level: Optional[LogLevel] = None,
    env: Optional[dict] = None,
) -> dict:
    """Returns a container configuration.

    This methods serves as a convenience method to return a config which
    is set up based on the provided arguments.

    Note:
        Each of the following keys (with a corresponding value) have to
        be present in the `env` (if it is not ``None``):
            * ``"HOST_USER_DIR"``
            * ``"HOST_CONFIG_DIR"``
            * ``"HOST_REPO_DIR"``
            * ``"HOST_OS"``
            * ``"ORCHEST_HOST_GID"``

    Args:
        port: The port Orchest will listen on.
        cloud: If the configuration should be setup for running in the
            cloud.
        dev: If the configuration should be setup for running in dev
            mode.
        log_level: Log level inside of the application.
        env: Dictionary containing the environment from which to
            construct the container configurations.

    """
    config = get_reg_container_config(port, env)

    if cloud:
        update_container_config_with_cloud(config, env)

    if dev:
        update_container_config_with_dev(config, env)

    if log_level is not None:
        update_container_config_log_level(config, log_level)

    return config


def get_reg_container_config(port: int, env: Optional[dict] = None) -> dict:
    """Constructs the container config to run Orchest.

    Note:
        The returned dictionary needs to contain a configuration
        specification for every container that is to be started through
        the orchest-ctl.

    Note:
        The returned configuration adheres to:
        https://docs.docker.com/engine/api/v1.41/#operation/ContainerCreate

    Args:
        port: The port Orchest will listen on.
        env: Refer to :meth:`get_container_config`.

    Returns:
        Dictionary mapping the name of the docker containers to their
        respective configs in the format required by the docker engine
        API.

    """
    if env is None:
        env = utils.get_env()

    # name -> request body
    container_config = {
        "orchest-api": {
            "Image": "orchest/orchest-api:latest",
            "Env": [
                f'ORCHEST_HOST_GID={env["ORCHEST_HOST_GID"]}',
                "PYTHONUNBUFFERED=TRUE",
            ],
            "HostConfig": {
                "GroupAdd": [f'{env["ORCHEST_HOST_GID"]}'],
                "Binds": [
                    "/var/run/docker.sock:/var/run/docker.sock",
                    f'{env["HOST_USER_DIR"]}:/userdir',
                ],
            },
            "NetworkingConfig": {"EndpointsConfig": {_config.DOCKER_NETWORK: {}}},
        },
        "orchest-webserver": {
            "Image": "orchest/orchest-webserver:latest",
            "Env": [
                f"ORCHEST_PORT={port}",
                f'HOST_USER_DIR={env["HOST_USER_DIR"]}',
                f'HOST_CONFIG_DIR={env["HOST_CONFIG_DIR"]}',
                f'HOST_REPO_DIR={env["HOST_REPO_DIR"]}',
                f'HOST_OS={env["HOST_OS"]}',
                "PYTHONUNBUFFERED=TRUE",
            ],
            "HostConfig": {
                "GroupAdd": [f'{env["ORCHEST_HOST_GID"]}'],
                "Binds": [
                    "/var/run/docker.sock:/var/run/docker.sock",
                    f'{env["HOST_USER_DIR"]}:/userdir',
                    f'{env["HOST_CONFIG_DIR"]}:/config',
                    f'{env["HOST_REPO_DIR"]}:/orchest-host',
                ],
            },
            "NetworkingConfig": {"EndpointsConfig": {_config.DOCKER_NETWORK: {}}},
        },
        "celery-worker": {
            "Image": "orchest/celery-worker:latest",
            "Env": [
                f'ORCHEST_HOST_GID={env["ORCHEST_HOST_GID"]}',
                # Set a default log level because supervisor can't deal
                # with non assigned env variables.
                "ORCHEST_LOG_LEVEL=INFO",
            ],
            "HostConfig": {
                "GroupAdd": [f'{env["ORCHEST_HOST_GID"]}'],
                "Binds": [
                    "/var/run/docker.sock:/var/run/docker.sock",
                    # Mount is needed for copying the snapshot dir to
                    # pipeline run dirs for jobs.
                    f'{env["HOST_USER_DIR"]}:/userdir',
                ],
            },
            "NetworkingConfig": {"EndpointsConfig": {_config.DOCKER_NETWORK: {}}},
        },
        "rabbitmq-server": {
            "Image": "rabbitmq:3",
            "HostName": "rabbitmq-server",
            "HostConfig": {
                "Binds": [
                    # Persisting RabbitMQ Queues.
                    os.path.join(env["HOST_USER_DIR"], ".orchest/rabbitmq-mnesia")
                    + ":/var/lib/rabbitmq/mnesia",
                ],
            },
            "NetworkingConfig": {"EndpointsConfig": {_config.DOCKER_NETWORK: {}}},
        },
        "auth-server": {
            "Image": "orchest/auth-server:latest",
            "Env": [
                "PYTHONUNBUFFERED=TRUE",
                f'HOST_OS={env["HOST_OS"]}',
            ],
            "HostConfig": {
                "Binds": [
                    f'{env["HOST_USER_DIR"]}:/userdir',
                    f'{env["HOST_CONFIG_DIR"]}:/config',
                ],
            },
            "NetworkingConfig": {"EndpointsConfig": {_config.DOCKER_NETWORK: {}}},
        },
        "file-manager": {
            "Image": "orchest/file-manager:latest",
            "HostConfig": {
                "GroupAdd": [f'{env["ORCHEST_HOST_GID"]}'],
                "Binds": [
                    f'{env["HOST_USER_DIR"]}:/userdir',
                ],
            },
            "NetworkingConfig": {"EndpointsConfig": {_config.DOCKER_NETWORK: {}}},
        },
        "nginx-proxy": {
            "Image": "orchest/nginx-proxy:latest",
            "ExposedPorts": {"80/tcp": {}},
            "HostConfig": {
                "PortBindings": {
                    # Exposure of 443 is injected based on certs.
                    "80/tcp": [{"HostPort": f"{port}"}],
                },
                # Injected based on presence of certs on host.
                "Binds": [],
            },
            "NetworkingConfig": {"EndpointsConfig": {_config.DOCKER_NETWORK: {}}},
        },
        "orchest-database": {
            "Image": "postgres:13.1",
            "Env": [
                "PGDATA=/userdir/.orchest/database/data",
                "POSTGRES_HOST_AUTH_METHOD=trust",
            ],
            "HostConfig": {
                "Binds": [
                    os.path.join(env["HOST_USER_DIR"], ".orchest/database")
                    + ":/userdir/.orchest/database",
                ],
            },
            "NetworkingConfig": {"EndpointsConfig": {_config.DOCKER_NETWORK: {}}},
        },
        "update-server": {
            "Image": "orchest/update-server:latest",
            "Env": [
                f"ORCHEST_PORT={port}",
                f'HOST_USER_DIR={env["HOST_USER_DIR"]}',
                f'HOST_CONFIG_DIR={env["HOST_CONFIG_DIR"]}',
                f'HOST_REPO_DIR={env["HOST_REPO_DIR"]}',
                f'HOST_OS={env["HOST_OS"]}',
            ],
            "HostConfig": {
                "Binds": [
                    "/var/run/docker.sock:/var/run/docker.sock",
                ],
            },
            "NetworkingConfig": {"EndpointsConfig": {_config.DOCKER_NETWORK: {}}},
        },
    }

    if utils.do_proxy_certs_exist_on_host():
        certs_bind: dict = {
            "nginx-proxy": {
                "Env": [
                    "ENABLE_SSL=true",
                ],
                "ExposedPorts": {"443/tcp": {}},
                "HostConfig": {
                    "PortBindings": {
                        "443/tcp": [{"HostPort": "443"}],
                    },
                    "Binds": [
                        os.path.join(
                            env["HOST_REPO_DIR"], "services", "nginx-proxy", "certs"
                        )
                        + ":/etc/ssl/certs",
                    ],
                },
            },
        }
        inject_dict(container_config, certs_bind, overwrite=True)

    return container_config


def update_container_config_with_cloud(
    container_config: dict, env: Optional[dict] = None
) -> None:
    """Updates the container config to run with --cloud.

    Args:
        container_config: An existing container config, to be updated in
            place.
        env: Refer to :meth:`get_container_config`.
    """
    if env is None:
        env = utils.get_env()

    utils.echo("Starting Orchest with --cloud. Some GUI functionality is altered.")

    cloud_inject = {
        "orchest-webserver": {
            "Env": [
                "CLOUD=true",
            ],
        },
        "update-server": {
            "Env": [
                "CLOUD=true",
            ],
        },
        "auth-server": {
            "Env": [
                "CLOUD=true",
            ],
        },
    }

    inject_dict(container_config, cloud_inject, overwrite=False)


def update_container_config_with_dev(
    container_config: dict, env: Optional[dict] = None
) -> None:
    """Updates the container config to run with --dev.

    Args:
        container_config: An existing container config, to be updated in
            place.
        env: Refer to :meth:`get_container_config`.
    """
    if env is None:
        env = utils.get_env()

    dev_inject = {
        "orchest-webserver": {
            "Cmd": ["./debug.sh"],
            "Env": [
                "FLASK_ENV=development",
            ],
            "HostConfig": {
                "Binds": [
                    os.path.join(
                        env["HOST_REPO_DIR"], "services", "orchest-webserver", "app"
                    )
                    + ":/orchest/services/orchest-webserver/app",
                    # Internal library.
                    os.path.join(env["HOST_REPO_DIR"], "lib") + ":/orchest/lib",
                ],
            },
        },
        "auth-server": {
            "Cmd": ["sh", "-c", "umask 002 && flask run --host=0.0.0.0 --port=80"],
            "Env": ["FLASK_APP=main.py", "FLASK_DEBUG=1", "FLASK_ENV=development"],
            "HostConfig": {
                "Binds": [
                    os.path.join(env["HOST_REPO_DIR"], "services", "auth-server", "app")
                    + ":/orchest/services/auth-server/app",
                    # Internal library.
                    os.path.join(env["HOST_REPO_DIR"], "lib") + ":/orchest/lib",
                ],
            },
        },
        "file-manager": {
            "HostConfig": {
                "Binds": [
                    os.path.join(
                        env["HOST_REPO_DIR"], "services", "file-manager", "static"
                    )
                    + ":/custom-static",
                ],
            },
        },
        "orchest-api": {
            "Cmd": ["flask", "run", "--host=0.0.0.0", "--port=80"],
            "Env": [
                "FLASK_APP=main.py",
                "FLASK_ENV=development",
            ],
            "ExposedPorts": {"80/tcp": {}},
            "HostConfig": {
                "PortBindings": {
                    # Expose Swagger.
                    "80/tcp": [{"HostPort": "8080"}],
                },
                "Binds": [
                    os.path.join(env["HOST_REPO_DIR"], "services", "orchest-api", "app")
                    + ":/orchest/services/orchest-api/app",
                    # Internal library.
                    os.path.join(env["HOST_REPO_DIR"], "lib") + ":/orchest/lib",
                ],
            },
        },
        "update-server": {
            "Env": [
                "FLASK_ENV=development",
            ],
        },
    }

    inject_dict(container_config, dev_inject, overwrite=False)


def update_container_config_log_level(
    container_config: dict, log_level: LogLevel
) -> None:
    """Updates the container config for logging purposes.

    Args:
        container_config: An existing container config, to be updated in
            place.
        log_level: Refer to :meth:`get_container_config`.

    """

    logging_env = f"ORCHEST_LOG_LEVEL={log_level.value}"
    log_levels: dict = {
        "orchest-webserver": {
            "Env": [logging_env],
        },
        "orchest-api": {
            "Env": [logging_env],
        },
        "auth-server": {
            "Env": [logging_env],
        },
        "celery-worker": {
            "Env": [logging_env],
        },
    }
    inject_dict(container_config, log_levels, overwrite=False)
