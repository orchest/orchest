# TODO: RENAME THIS MODULE!

import os
from collections.abc import Container
from typing import Dict, Iterable, Literal, Optional

# TODO: Errors need to end in Error
from app.errors import ENVVariableNotFound
from app.new_config import DOCKER_NETWORK


def inject_dict(self, other: dict, overwrite: bool = True) -> None:
    """Recursively injects (in-place) another dict into self.

    In contrast to ``dict.update()`` this method recurses into
    nested dictionaries updating the values.

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
        if (name in self and isinstance(self[name], dict) and
                isinstance(config, dict)):
            inject_dict(self[name], config, overwrite=overwrite)
        elif (name in self and isinstance(self[name], list) and
                isinstance(type(config), list)):
            self[name] += config
        else:
            self[name] = config


# TODO: possible add to utils.py
def get_env():
    env_vars = ["HOST_USER_DIR", "HOST_CONFIG_DIR", "HOST_REPO_DIR", "HOST_OS"]
    env = {var: os.environ.get(var) for var in env_vars}

    not_present = [var for var, value in env.items() if value is None]
    if not_present:
        raise ENVVariableNotFound(
            "Required environment variables are not present: "
            + ", ".join(not_present)
        )

    if env["HOST_OS"] == "darwin":
        # macOs UID/GID behaves differently with Docker bind mounts. For
        # the exact permission behaviour see:
        # https://github.com/docker/for-mac/issues/2657#issuecomment-371210749
        env["ORCHEST_HOST_GID"] = 100
    else:
        env["ORCHEST_HOST_GID"] = os.stat("/orchest-host/orchest").st_gid

    return env


def filter_container_config(
    container_config: dict, filter: Dict[str, Container]
) -> dict:
    """Filter the given container config based on a filter.

    Note:
        The filter is only applied to second-level keys. That is nested
        one level.

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

    """
    res = {}
    for key, valid_options in filter.items():
        for name, config in container_config.items():
            if config.get(key) is not None and config[key] in valid_options:
                res[name] = config

    return res


def get_container_config(
    mode: Literal["reg", "dev"], env: Optional[dict] = None
) -> dict:
    if mode == "reg":
        return get_reg_container_config(env)

    if mode == "dev":
        return get_dev_container_config(env)


def get_reg_container_config(env: Optional[dict] = None) -> dict:
    """
    Config adheres to:
        https://docs.docker.com/engine/api/v1.41/#operation/ContainerCreate
    """
    if env is None:
        env = get_env()

    # name -> request body
    container_config = {
        "orchest-api": {
            "Image": "orchest/orchest-api:latest",
            "Env": [
                f'ORCHEST_HOST_GID={env["ORCHEST_HOST_GID"]}',
            ],
            "HostConfig": {
                "GroupAdd": [f'{env["ORCHEST_HOST_GID"]}'],
                "Binds": [
                    "/var/run/docker.sock:/var/run/docker.sock",
                    f'{env["HOST_USER_DIR"]}:/userdir',
                ]
            },
            "NetworkingConfig": {
                "EndpointsConfig": {DOCKER_NETWORK: {}}
            },
        },
        "orchest-webserver": {
            "Image": "orchest/orchest-webserver:latest",
            "Env": [
                f'HOST_USER_DIR={env["HOST_USER_DIR"]}',
                f'HOST_CONFIG_DIR={env["HOST_CONFIG_DIR"]}',
                f'HOST_REPO_DIR={env["HOST_REPO_DIR"]}',
                f'HOST_OS={env["HOST_OS"]}',
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
            "NetworkingConfig": {
                "EndpointsConfig": {DOCKER_NETWORK: {}}
            },
        },
        "celery-worker": {
            "Image": "orchest/celery-worker:latest",
            "Env": [
                f'ORCHEST_HOST_GID={env["ORCHEST_HOST_GID"]}',
            ],
            "HostConfig": {
                "GroupAdd": [f'{env["ORCHEST_HOST_GID"]}'],
                "Binds": [
                    "/var/run/docker.sock:/var/run/docker.sock",
                    # Mount is needed for copying the snapshot dir to
                    # pipeline run dirs for experiments.
                    f'{env["HOST_USER_DIR"]}:/userdir',
                ],
            },
            "NetworkingConfig": {
                "EndpointsConfig": {DOCKER_NETWORK: {}}
            },
        },
        "rabbitmq-server": {
            "Image": "rabbitmq:3",
            "HostName": "rabbitmq-server",
            "HostConfig": {
                "Binds": [
                    # Persisting RabbitMQ Queues.
                    os.path.join(
                        env["HOST_USER_DIR"], ".orchest/rabbitmq-mnesia"
                    ) + ":/var/lib/rabbitmq/mnesia",
                ],
            },
            "NetworkingConfig": {
                "EndpointsConfig": {DOCKER_NETWORK: {}}
            },
        },
        "auth-server": {
            "Image": "orchest/auth-server:latest",
            "HostConfig": {
                "Binds": [
                    f'{env["HOST_USER_DIR"]}:/userdir',
                    f'{env["HOST_CONFIG_DIR"]}:/config',
                ],
            },
            "NetworkingConfig": {
                "EndpointsConfig": {DOCKER_NETWORK: {}}
            },
        },
        "file-manager": {
            "Image": "orchest/file-manager:latest",
            "HostConfig": {
                "GroupAdd": [f'{env["ORCHEST_HOST_GID"]}'],
                "Binds": [
                    f'{env["HOST_USER_DIR"]}:/userdir',
                ],
            },
            "NetworkingConfig": {
                "EndpointsConfig": {DOCKER_NETWORK: {}}
            },
        },
        "nginx-proxy": {
            "Image": "orchest/nginx-proxy:latest",
            "ExposedPorts": {
                "80/tcp": {}
            },
            "HostConfig": {
                "PortBindings": {
                    # Exposure of 443 is injected based on certs.
                    "80/tcp": [{"HostPort": "8000"}],
                },
                # Injected based on presence of certs on host.
                "Binds": [],
            },
            "NetworkingConfig": {
                "EndpointsConfig": {DOCKER_NETWORK: {}}
            },
        },
        "orchest-database": {
            "Image": "postgres:13.1",
            "Env": [
                "PGDATA=/userdir/.orchest/database/data",
                "POSTGRES_HOST_AUTH_METHOD=trust",
            ],
            "HostConfig": {
                "Binds": [
                    os.path.join(
                        env["HOST_USER_DIR"], ".orchest/database"
                    ) + ":/userdir/.orchest/database",
                ],
            },
            "NetworkingConfig": {
                "EndpointsConfig": {DOCKER_NETWORK: {}}
            },
        },
        "update-server": {
            "Image": "orchest/update-server:latest",
            "Env": [
                f'HOST_USER_DIR={env["HOST_USER_DIR"]}',
                f'HOST_CONFIG_DIR={env["HOST_CONFIG_DIR"]}',
                f'HOST_REPO_DIR={env["HOST_REPO_DIR"]}',
                f'HOST_OS={env["HOST_OS"]}',
            ],
            "HostConfig": {
                "Binds": [
                    "/var/run/docker.sock:/var/run/docker.sock",
                ],
                "AutoRemove": True,
            },
            "NetworkingConfig": {
                "EndpointsConfig": {DOCKER_NETWORK: {}}
            },
        },
    }

    if do_proxy_certs_exist_on_host():
        certs_bind: dict = {
            "nginx-proxy": {
                "ExposedPorts": {
                    "443/tcp": {}
                },
                "HostConfig": {
                    "PortBindings": {
                        "443/tcp": [{"HostPort": "443"}],
                    },
                    "Binds": [
                        os.path.join(
                            env["HOST_REPO_DIR"], "services", "nginx-proxy", "certs"
                        ) + ":/etc/ssl/certs",
                    ],
                },
            },
        }
        inject_dict(container_config, certs_bind, overwrite=True)

    # return container_config
    return container_config


def get_dev_container_config(env: Optional[dict] = None) -> dict:
    if env is None:
        env = get_env()

    container_config = get_reg_container_config(env)

    # Injects
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
                    ) + ":/orchest/services/orchest-webserver/app",
                    # Internal library.
                    os.path.join(env["HOST_REPO_DIR"], "lib") + ":/orchest/lib",
                ],
            },
        },
        "auth-server": {
            "Cmd": ["flask", "run", "--host=0.0.0.0", "--port=80"],
            "Env": [
                "FLASK_APP=main.py",
                "FLASK_DEBUG=1",
            ],
            "HostConfig": {
                "Binds": [
                    os.path.join(
                        env["HOST_REPO_DIR"], "services", "auth-server", "app"
                    ) + ":/orchest/services/auth-server/app",
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
                    ) + ":/custom-static",
                ],
            },
        },
        "orchest-api": {
            "Cmd": ["flask", "run", "--host=0.0.0.0", "--port=80"],
            "Env": [
                "FLASK_APP=main.py",
                "FLASK_ENV=development",
            ],
            "ExposedPorts": {
                "80/tcp": {}
            },
            "HostConfig": {
                "PortBindings": {
                    # Expose Swagger.
                    "80/tcp": [{"HostPort": "8080"}],
                },
                "Binds": [
                    os.path.join(
                        env["HOST_REPO_DIR"], "services", "orchest-api", "app"
                    ) + ":/orchest/services/orchest-api/app",
                    # Internal library.
                    os.path.join(env["HOST_REPO_DIR"], "lib") + ":/orchest/lib",
                ],
            },
        },
    }

    inject_dict(container_config, dev_inject, overwrite=False)
    return container_config


def do_proxy_certs_exist_on_host() -> bool:
    certs_path = "/orchest-host/services/nginx-proxy/certs/"

    crt_exists = os.path.isfile(os.path.join(certs_path, "server.crt"))
    key_exists = os.path.isfile(os.path.join(certs_path, "server.key"))

    return crt_exists and key_exists
