import os
import traceback
from typing import Any, Dict, Tuple

from _orchest.internals import config as _config
from _orchest.internals.utils import get_k8s_namespace_name
from app import utils
from config import CONFIG_CLASS


def _get_volumes(
    project_uuid: str,
    host_project_dir: str,
    project_relative_pipeline_path: str,
    host_userdir: str,
) -> Dict[str, Dict]:
    # Make sure the same set of keys is available for all cases.
    volumes = {
        "kernelspec": None,
        "jupyterlab-lab": None,
        "jupyterlab-user-settings": None,
        "jupyterlab-data": None,
    }

    # K8S_TODO: we are not mounting the docker sock anymore since aren't
    # spawning containers from other containers. Is there something else
    # we should pass?

    volumes["project-dir"] = {
        "name": "project-dir",
        "hostPath": {"path": host_project_dir},
    }
    volumes["pipeline-file"] = {
        "name": "pipeline-file",
        "hostPath": {
            "path": os.path.join(host_project_dir, project_relative_pipeline_path)
        },
    }

    # The `host_userdir` is only passed for interactive runs.
    if host_userdir is not None:
        source_kernelspecs = os.path.join(
            host_userdir, _config.KERNELSPECS_PATH.format(project_uuid=project_uuid)
        )
        volumes["kernelspec"] = {
            "name": "kernelspec",
            "hostPath": {"path": source_kernelspecs},
        }

        # User configurations of the JupyterLab IDE.
        volumes["jupyterlab-lab"] = {
            "name": "jupyterlab-lab",
            "hostPath": {
                "path": os.path.join(
                    host_userdir, ".orchest/user-configurations/jupyterlab/lab"
                ),
            },
        }
        volumes["jupyterlab-user-settings"] = {
            "name": "jupyterlab-user-settings",
            "hostPath": {
                "path": os.path.join(
                    host_userdir,
                    ".orchest/user-configurations/jupyterlab/user-settings",
                ),
            },
        }
        volumes["jupyterlab-data"] = {
            "name": "jupyterlab-data",
            "hostPath": {
                "path": os.path.join(host_userdir, "data"),
            },
        }

    return volumes


def _get_volume_mounts(
    container_project_dir: str, container_pipeline_path: str, session_type: str
) -> Dict[str, Dict]:
    # Make sure the same set of keys is available for all cases.
    volumes_mounts = {
        "kernelspec": None,
        "jupyterlab-lab": None,
        "jupyterlab-user-settings": None,
        "jupyterlab-data": None,
    }

    # K8S_TODO: we are not mounting the docker sock anymore since aren't
    # spawning containers from other containers. Is there something else
    # we should pass?

    volumes_mounts["project-dir"] = {
        "name": "project-dir",
        "mountPath": container_project_dir,
    }
    volumes_mounts["pipeline-file"] = {
        "name": "pipeline-file",
        "mountPath": container_pipeline_path,
    }

    # The `host_userdir` is only passed for interactive runs.
    if session_type == "interactive":
        volumes_mounts["kernelspec"] = {
            "name": "kernelspec",
            "mountPath": "/usr/local/share/jupyter/kernels",
        }

        volumes_mounts["jupyterlab-lab"] = {
            "name": "jupyterlab-lab",
            "mountPath": "/usr/local/share/jupyter/lab",
        }

        volumes_mounts["jupyterlab-user-settings"] = {
            "name": "jupyterlab-user-settings",
            "mountPath": "/root/.jupyter/lab/user-settings",
        }

        volumes_mounts["jupyterlab-data"] = {
            "name": "jupyterlab-data",
            "mountPath": "/data",
        }

    return volumes_mounts


def _get_memory_server_deployment_manifest(
    session_uuid: str,
    session_config: str,
    session_type: str,
) -> dict:
    project_uuid = session_config["project_uuid"]
    pipeline_uuid = session_config["pipeline_uuid"]
    project_relative_pipeline_path = session_config["pipeline_path"]
    host_project_dir = session_config["project_dir"]
    host_userdir = session_config["host_userdir"]

    metadata = {
        "name": "memory-server",
        "labels": {
            "app": "memory-server",
            "project_uuid": project_uuid,
            "session_uuid": session_uuid,
        },
    }
    volumes_dict = _get_volumes(
        project_uuid, host_project_dir, project_relative_pipeline_path, host_userdir
    )
    volume_mounts_dict = _get_volume_mounts(
        _config.PROJECT_DIR, _config.PIPELINE_FILE, session_type
    )
    return {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": metadata,
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": {"app": "memory-server"}},
            "template": {
                "metadata": metadata,
                "spec": {
                    "securityContext": {
                        "runAsUser": 0,
                        "runAsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                        "fsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                    },
                    # The memory server is not respecting the SIGTERM
                    # signal handler, apparently because of the plasma
                    # client.
                    "terminationGracePeriodSeconds": 1,
                    "resources": {
                        "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
                    },
                    "volumes": [
                        volumes_dict["project-dir"],
                        volumes_dict["pipeline-file"],
                        {"name": "dev-shm", "emptyDir": {"medium": "Memory"}},
                    ],
                    "containers": [
                        {
                            "name": "memory-server",
                            "image": "orchest/memory-server:latest",
                            # K8S_TODO: fix me.
                            "imagePullPolicy": "IfNotPresent",
                            "env": [
                                {
                                    "name": "ORCHEST_PROJECT_UUID",
                                    "value": project_uuid,
                                },
                                {
                                    "name": "ORCHEST_PIPELINE_UUID",
                                    "value": pipeline_uuid,
                                },
                                {
                                    "name": "ORCHEST_PIPELINE_PATH",
                                    "value": _config.PIPELINE_FILE,
                                },
                                {
                                    "name": "ORCHEST_SESSION_UUID",
                                    "value": session_uuid,
                                },
                                {
                                    "name": "ORCHEST_SESSION_TYPE",
                                    "value": session_type,
                                },
                            ],
                            "volumeMounts": [
                                volume_mounts_dict["pipeline-file"],
                                volume_mounts_dict["project-dir"],
                                {"name": "dev-shm", "mountPath": "/dev/shm"},
                            ],
                        }
                    ],
                },
            },
        },
    }


def _get_session_sidecar_deployment_manifest(
    session_uuid: str,
    session_config: str,
    session_type: str,
) -> dict:
    project_uuid = session_config["project_uuid"]
    pipeline_uuid = session_config["pipeline_uuid"]
    project_relative_pipeline_path = session_config["pipeline_path"]
    host_project_dir = session_config["project_dir"]
    host_userdir = session_config["host_userdir"]

    metadata = {
        "name": "session-sidecar",
        "labels": {
            "app": "session-sidecar",
            "project_uuid": project_uuid,
            "session_uuid": session_uuid,
        },
    }
    volumes_dict = _get_volumes(
        project_uuid, host_project_dir, project_relative_pipeline_path, host_userdir
    )
    volume_mounts_dict = _get_volume_mounts(
        _config.PROJECT_DIR, _config.PIPELINE_FILE, session_type
    )
    return {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": metadata,
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": {"app": metadata["name"]}},
            "template": {
                "metadata": metadata,
                "spec": {
                    "securityContext": {
                        "runAsUser": 0,
                        "runAsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                        "fsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                    },
                    # This account is needed to get pods and their
                    # logs, K8S_TODO: make an ad hoc role for the
                    # session sidecar?
                    "resources": {
                        "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
                    },
                    "volumes": [
                        volumes_dict["project-dir"],
                        volumes_dict["pipeline-file"],
                    ],
                    "containers": [
                        {
                            "name": metadata["name"],
                            "image": "orchest/session-sidecar:latest",
                            # K8S_TODO: fix me.
                            "imagePullPolicy": "IfNotPresent",
                            "env": [
                                {
                                    "name": "ORCHEST_PROJECT_UUID",
                                    "value": project_uuid,
                                },
                                {
                                    "name": "ORCHEST_PIPELINE_UUID",
                                    "value": pipeline_uuid,
                                },
                                {
                                    "name": "ORCHEST_PIPELINE_PATH",
                                    "value": _config.PIPELINE_FILE,
                                },
                                {
                                    "name": "ORCHEST_SESSION_UUID",
                                    "value": session_uuid,
                                },
                                {
                                    "name": "ORCHEST_SESSION_TYPE",
                                    "value": session_type,
                                },
                                {
                                    "name": "K8S_NAMESPACE",
                                    "value": get_k8s_namespace_name(session_uuid),
                                },
                            ],
                            "volumeMounts": [
                                volume_mounts_dict["project-dir"],
                                volume_mounts_dict["pipeline-file"],
                            ],
                        }
                    ],
                },
            },
        },
    }


def _get_jupyter_server_deployment_service_manifest(
    session_uuid: str,
    session_config: str,
    session_type: str,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    project_uuid = session_config["project_uuid"]
    project_relative_pipeline_path = session_config["pipeline_path"]
    host_project_dir = session_config["project_dir"]
    host_userdir = session_config["host_userdir"]

    metadata = {
        "name": "jupyter-server",
        "labels": {
            "app": "jupyter-server",
            "project_uuid": project_uuid,
            "session_uuid": session_uuid,
        },
    }

    # Check if user tweaked JupyterLab image exists.
    if utils.get_environment_image_docker_id(_config.JUPYTER_IMAGE_NAME) is not None:
        image = _config.JUPYTER_IMAGE_NAME
    else:
        image = "orchest/jupyter-server:latest"

    volumes_dict = _get_volumes(
        project_uuid, host_project_dir, project_relative_pipeline_path, host_userdir
    )
    volume_mounts_dict = _get_volume_mounts(
        _config.PROJECT_DIR, _config.PIPELINE_FILE, session_type
    )
    deployment_manifest = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": metadata,
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": {"app": metadata["name"]}},
            "template": {
                "metadata": metadata,
                "spec": {
                    "securityContext": {
                        "runAsUser": 0,
                        "runAsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                        "fsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                    },
                    "resources": {
                        "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
                    },
                    "volumes": [
                        volumes_dict["project-dir"],
                        volumes_dict["pipeline-file"],
                        volumes_dict["jupyterlab-lab"],
                        volumes_dict["jupyterlab-user-settings"],
                        volumes_dict["jupyterlab-data"],
                    ],
                    "containers": [
                        {
                            "name": metadata["name"],
                            "image": image,
                            # K8S_TODO: fix me.
                            "imagePullPolicy": "IfNotPresent",
                            "volumeMounts": [
                                volume_mounts_dict["project-dir"],
                                volume_mounts_dict["pipeline-file"],
                                volume_mounts_dict["jupyterlab-lab"],
                                volume_mounts_dict["jupyterlab-user-settings"],
                                volume_mounts_dict["jupyterlab-data"],
                            ],
                            # K8S_TODO: will require changes based on
                            # how ingress is implemented.
                            "args": [
                                "--allow-root",
                                "--port=8888",
                                "--no-browser",
                                (
                                    "--gateway-url=http://jupyter-eg:8888/"
                                    f'{metadata["name"]}'
                                ),
                                f"--notebook-dir={_config.PROJECT_DIR}",
                                f'--ServerApp.base_url=/{metadata["name"]}',
                            ],
                        }
                    ],
                },
            },
        },
    }

    # K8S_TODO: will require changes based on
    # how ingress is implemented.
    service_manifest = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": metadata,
        "spec": {
            "type": "ClusterIP",
            "selector": {"app": metadata["name"]},
            "ports": [{"port": 8888}],
        },
    }
    return deployment_manifest, service_manifest


def _get_jupyter_enterprise_gateway_deployment_service_manifest(
    session_uuid: str,
    session_config: str,
    session_type: str,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    project_uuid = session_config["project_uuid"]
    pipeline_uuid = session_config["pipeline_uuid"]
    project_relative_pipeline_path = session_config["pipeline_path"]
    host_project_dir = session_config["project_dir"]
    host_userdir = session_config["host_userdir"]

    metadata = {
        "name": "jupyter-eg",
        "labels": {
            "app": "jupyter-eg",
            "project_uuid": project_uuid,
            "session_uuid": session_uuid,
        },
    }

    # Get user environment variables to pass to Jupyter kernels.
    try:
        user_defined_env_vars = utils.get_proj_pip_env_variables(
            project_uuid, pipeline_uuid
        )
    except Exception:
        user_defined_env_vars = {}

    process_env_whitelist = [
        "ORCHEST_PIPELINE_UUID",
        "ORCHEST_PIPELINE_PATH",
        "ORCHEST_PROJECT_UUID",
        "ORCHEST_HOST_PROJECT_DIR",
        "ORCHEST_HOST_PIPELINE_FILE",
        "ORCHEST_HOST_GID",
        "ORCHEST_SESSION_UUID",
        "ORCHEST_SESSION_TYPE",
        "ORCHEST_GPU_ENABLED_INSTANCE",
    ]
    process_env_whitelist.extend(list(user_defined_env_vars.keys()))
    process_env_whitelist = ",".join(process_env_whitelist)

    environment = {
        "EG_MIRROR_WORKING_DIRS": "True",
        "EG_LIST_KERNELS": "True",
        "EG_KERNEL_WHITELIST": "[]",
        "EG_PROHIBITED_UIDS": "[]",
        "EG_UNAUTHORIZED_USERS": '["dummy"]',
        "EG_UID_BLACKLIST": '["-1"]',
        "EG_ALLOW_ORIGIN": "*",
        "EG_BASE_URL": "/jupyter-server",
        "EG_ENV_PROCESS_WHITELIST": process_env_whitelist,
        "ORCHEST_PIPELINE_UUID": pipeline_uuid,
        "ORCHEST_PIPELINE_PATH": _config.PIPELINE_FILE,
        "ORCHEST_PROJECT_UUID": project_uuid,
        "ORCHEST_HOST_PROJECT_DIR": host_project_dir,
        "ORCHEST_HOST_PIPELINE_FILE": os.path.join(
            host_project_dir, project_relative_pipeline_path
        ),
        "ORCHEST_HOST_GID": os.environ.get("ORCHEST_HOST_GID"),
        "ORCHEST_SESSION_UUID": session_uuid,
        "ORCHEST_SESSION_TYPE": session_type,
        "ORCHEST_GPU_ENABLED_INSTANCE": str(CONFIG_CLASS.GPU_ENABLED_INSTANCE),
    }
    environment = [{"name": k, "value": v} for k, v in environment.items()]
    user_defined_env_vars = [
        {"name": key, "value": value} for key, value in user_defined_env_vars.items()
    ]
    environment.extend(user_defined_env_vars)

    volumes_dict = _get_volumes(
        project_uuid, host_project_dir, project_relative_pipeline_path, host_userdir
    )
    volume_mounts_dict = _get_volume_mounts(
        _config.PROJECT_DIR, _config.PIPELINE_FILE, session_type
    )
    deployment_manifest = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": metadata,
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": {"app": metadata["name"]}},
            "template": {
                "metadata": metadata,
                "spec": {
                    "securityContext": {
                        "runAsUser": 0,
                        "runAsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                        "fsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                    },
                    "resources": {
                        "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
                    },
                    "volumes": [
                        volumes_dict["kernelspec"],
                    ],
                    "containers": [
                        {
                            "name": metadata["name"],
                            "image": "orchest/jupyter-enterprise-gateway",
                            # K8S_TODO: fix me.
                            "imagePullPolicy": "IfNotPresent",
                            "env": environment,
                            "volumeMounts": [
                                volume_mounts_dict["kernelspec"],
                            ],
                        }
                    ],
                },
            },
        },
    }

    # K8S_TODO: will require changes based on how ingress is
    # implemented.
    service_manifest = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": metadata,
        "spec": {
            "type": "ClusterIP",
            "selector": {"app": metadata["name"]},
            "ports": [{"port": 8888}],
        },
    }
    return deployment_manifest, service_manifest


def _get_user_service_deployment_service_manifest(
    session_uuid: str,
    session_config: str,
    service_config: Dict[str, Any],
    session_type: str,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Get deployment and service manifest for a user service.

    Args:
            session_uuid:
            session_config: See `Args` section in class :class:`Session`
                    __init__ method.
            service_config: See `Args` section in class :class:`Session`
                    __init__ method.
            session_type: Type of session: interactive, or
                    noninteractive.

    Returns:
            Tuple of k8s deployment and service manifests to deploy this
            user service in the session.

    """
    project_uuid = session_config["project_uuid"]
    pipeline_uuid = session_config["pipeline_uuid"]
    project_relative_pipeline_path = session_config["pipeline_path"]
    host_project_dir = session_config["project_dir"]
    host_userdir = session_config["host_userdir"]
    img_mappings = session_config["env_uuid_docker_id_mappings"]

    # Get user configured environment variables
    try:
        if session_type == "noninteractive":
            # Get job environment variable overrides
            user_env_variables = session_config["user_env_variables"]
        else:
            user_env_variables = utils.get_proj_pip_env_variables(
                project_uuid, pipeline_uuid
            )
    except Exception as e:

        utils.get_logger().error(
            "Failed to fetch user_env_variables: %s [%s]" % (e, type(e))
        )

        traceback.print_exc()

        user_env_variables = {}

    environment = service_config.get("env_variables", {})
    # Inherited env vars supersede inherited ones.
    for inherited_key in service_config.get("env_variables_inherit", []):
        if inherited_key in user_env_variables:
            environment[inherited_key] = user_env_variables[inherited_key]

    # These are all required for the Orchest SDK to work.
    environment["ORCHEST_PROJECT_UUID"] = project_uuid
    environment["ORCHEST_PIPELINE_UUID"] = pipeline_uuid
    # So that the SDK can access the pipeline file.
    environment["ORCHEST_PIPELINE_PATH"] = _config.PIPELINE_FILE
    environment["ORCHEST_SESSION_UUID"] = session_uuid
    environment["ORCHEST_SESSION_TYPE"] = session_type
    env = []
    for k, v in environment.items():
        env.append({"name": k, "value": v})

    volumes = []
    volume_mounts = []
    sbinds = service_config.get("binds", {})
    volumes_dict = _get_volumes(
        project_uuid, host_project_dir, project_relative_pipeline_path, host_userdir
    )
    # Can be later extended into adding a Mount for every "custom"
    # key, e.g. key != data and key != project_directory.
    if "/data" in sbinds:
        volumes.append(volumes_dict["data"])
        volume_mounts.append({"name": "data", "mountPath": sbinds["/data"]})
    if "/project-dir" in sbinds:
        volumes.append(volumes_dict["project-dir"])
        volume_mounts.append(
            {"name": "project-dir", "mountPath": sbinds["/project-dir"]}
        )

    # To support orchest environments as services.
    image = service_config["image"]
    prefix = _config.ENVIRONMENT_AS_SERVICE_PREFIX
    if image.startswith(prefix):
        image = image.replace(prefix, "")
        image = img_mappings[image]

    metadata = {
        "name": service_config["name"],
        "labels": {
            "app": service_config["name"],
            "project_uuid": project_uuid,
            "session_uuid": session_uuid,
        },
    }

    deployment_manifest = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": metadata,
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": {"app": metadata["name"]}},
            "template": {
                "metadata": metadata,
                "spec": {
                    "securityContext": {
                        "runAsUser": 0,
                        "runAsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                        "fsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                    },
                    "resources": {
                        "requests": {"cpu": _config.USER_CONTAINERS_CPU_SHARES}
                    },
                    "volumes": volumes,
                    "containers": [
                        {
                            "name": metadata["name"],
                            "image": image,
                            # K8S_TODO: fix me.
                            "imagePullPolicy": "IfNotPresent",
                            "env": env,
                            "volumeMounts": volume_mounts,
                        }
                    ],
                },
            },
        },
    }

    # K8S_TODO: GUI & data changes to go from entrypoint and command
    # to command and args.
    if "entrypoint" in service_config:
        deployment_manifest["spec"]["template"]["spec"]["containers"][0][
            "command"
        ] = service_config["entrypoint"]

    if "command" in service_config:
        deployment_manifest["spec"]["template"]["spec"]["containers"][0][
            "args"
        ] = service_config["command"]

    service_manifest = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": metadata,
        "spec": {
            "type": "ClusterIP",
            "selector": {"app": metadata["name"]},
            "ports": [{"port": port} for port in service_config["ports"]],
        },
    }
    return deployment_manifest, service_manifest
