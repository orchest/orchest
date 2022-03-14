"""Collection of function to generate k8s manifests.

Note that pod labels are coupled with how we restart services, which
is done by deleting all pods with the given labels.
"""
import os
import traceback
from typing import Any, Dict, Tuple

from _orchest.internals import config as _config
from app import utils
from app.connections import k8s_core_api
from app.types import SessionConfig, SessionType
from config import CONFIG_CLASS

logger = utils.get_logger()


def _get_common_volumes_and_volume_mounts(
    host_userdir: str,
    host_project_dir: str,
    project_relative_pipeline_path: str,
    container_project_dir: str = _config.PROJECT_DIR,
    container_pipeline_path: str = _config.PIPELINE_FILE,
    container_data_dir: str = _config.DATA_DIR,
) -> Tuple[Dict[str, Dict], Dict[str, Dict]]:
    volumes = {}
    volume_mounts = {}

    volumes["project-dir"] = {
        "name": "project-dir",
        "hostPath": {"path": host_project_dir},
    }
    volume_mounts["project-dir"] = {
        "name": "project-dir",
        "mountPath": container_project_dir,
    }

    volumes["pipeline-file"] = {
        # This way the binding is persisted even if the pipeline file
        # is moved, since the binding happens through inodes.
        "name": "pipeline-file",
        "hostPath": {
            "path": os.path.join(host_project_dir, project_relative_pipeline_path)
        },
    }
    volume_mounts["pipeline-file"] = {
        "name": "pipeline-file",
        "mountPath": container_pipeline_path,
    }

    volumes["data"] = {
        "name": "data",
        "hostPath": {"path": os.path.join(host_userdir, "data")},
    }
    volume_mounts["data"] = {
        "name": "data",
        "mountPath": container_data_dir,
    }
    return volumes, volume_mounts


def _get_jupyter_volumes_and_volume_mounts(
    project_uuid: str,
    host_userdir: str,
    host_project_dir: str,
    project_relative_pipeline_path: str,
    container_project_dir: str = _config.PROJECT_DIR,
    container_pipeline_path: str = _config.PIPELINE_FILE,
    container_data_dir: str = _config.DATA_DIR,
) -> Tuple[Dict[str, Dict], Dict[str, Dict]]:
    volumes, volume_mounts = _get_common_volumes_and_volume_mounts(
        host_userdir,
        host_project_dir,
        project_relative_pipeline_path,
        container_project_dir,
        container_pipeline_path,
        container_data_dir,
    )

    source_kernelspecs = os.path.join(
        host_userdir, _config.KERNELSPECS_PATH.format(project_uuid=project_uuid)
    )
    volumes["kernelspec"] = {
        "name": "kernelspec",
        "hostPath": {"path": source_kernelspecs},
    }
    volume_mounts["kernelspec"] = {
        "name": "kernelspec",
        "mountPath": "/usr/local/share/jupyter/kernels",
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
    volume_mounts["jupyterlab-lab"] = {
        "name": "jupyterlab-lab",
        "mountPath": "/usr/local/share/jupyter/lab",
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
    volume_mounts["jupyterlab-user-settings"] = {
        "name": "jupyterlab-user-settings",
        "mountPath": "/root/.jupyter/lab/user-settings",
    }
    return volumes, volume_mounts


def _get_memory_server_deployment_manifest(
    session_uuid: str,
    session_config: SessionConfig,
    session_type: SessionType,
) -> dict:
    project_uuid = session_config["project_uuid"]
    pipeline_uuid = session_config["pipeline_uuid"]
    project_relative_pipeline_path = session_config["pipeline_path"]
    host_project_dir = session_config["project_dir"]
    host_userdir = session_config["host_userdir"]
    session_type = session_type.value

    metadata = {
        "name": f"memory-server-{session_uuid}",
        "labels": {
            "app": "memory-server",
            "project_uuid": project_uuid,
            "session_uuid": session_uuid,
        },
    }

    volumes_dict, volume_mounts_dict = _get_common_volumes_and_volume_mounts(
        host_userdir,
        host_project_dir,
        project_relative_pipeline_path,
    )

    return {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": metadata,
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": metadata["labels"]},
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


def _get_session_sidecar_rbac_manifests(
    session_uuid: str,
    session_config: SessionConfig,
) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:

    project_uuid = session_config["project_uuid"]
    ns = _config.ORCHEST_NAMESPACE

    role_manifest = {
        "kind": "Role",
        "apiVersion": "rbac.authorization.k8s.io/v1",
        "metadata": {
            "name": f"session-sidecar-role-{session_uuid}",
            "labels": {
                "app": "session-sidecar",
                "project_uuid": project_uuid,
                "session_uuid": session_uuid,
            },
        },
        "rules": [
            {
                "apiGroups": [
                    "",
                ],
                "resources": [
                    "pods",
                    "pods/log",
                ],
                "verbs": [
                    "get",
                    "list",
                    "watch",
                ],
            }
        ],
    }

    account_manifest = {
        "apiVersion": "v1",
        "kind": "ServiceAccount",
        "metadata": {
            "name": f"session-sidecar-sa-{session_uuid}",
            "labels": {
                "app": "session-sidecar",
                "project_uuid": project_uuid,
                "session_uuid": session_uuid,
            },
        },
    }

    rolebinding_manifest = {
        "kind": "RoleBinding",
        "apiVersion": "rbac.authorization.k8s.io/v1",
        "metadata": {
            "name": f"session-sidecar-rolebinding-{session_uuid}",
            "labels": {
                "app": "session-sidecar",
                "project_uuid": project_uuid,
                "session_uuid": session_uuid,
            },
        },
        "subjects": [
            {
                "kind": "ServiceAccount",
                "name": f"session-sidecar-sa-{session_uuid}",
                "namespace": ns,
            }
        ],
        "roleRef": {
            "kind": "Role",
            "name": f"session-sidecar-role-{session_uuid}",
            "apiGroup": "rbac.authorization.k8s.io",
        },
    }

    return role_manifest, account_manifest, rolebinding_manifest


def _get_session_sidecar_deployment_manifest(
    session_uuid: str,
    session_config: SessionConfig,
    session_type: SessionType,
) -> dict:
    project_uuid = session_config["project_uuid"]
    pipeline_uuid = session_config["pipeline_uuid"]
    project_relative_pipeline_path = session_config["pipeline_path"]
    host_project_dir = session_config["project_dir"]
    host_userdir = session_config["host_userdir"]
    session_type = session_type.value

    metadata = {
        "name": f"session-sidecar-{session_uuid}",
        "labels": {
            "app": "session-sidecar",
            "project_uuid": project_uuid,
            "session_uuid": session_uuid,
        },
    }

    volumes_dict, volume_mounts_dict = _get_common_volumes_and_volume_mounts(
        host_userdir,
        host_project_dir,
        project_relative_pipeline_path,
    )

    return {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": metadata,
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": metadata["labels"]},
            "template": {
                "metadata": metadata,
                "spec": {
                    "securityContext": {
                        "runAsUser": 0,
                        "runAsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                        "fsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                    },
                    "serviceAccount": f"session-sidecar-sa-{session_uuid}",
                    "serviceAccountName": f"session-sidecar-sa-{session_uuid}",
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
    session_config: SessionConfig,
    session_type: SessionType,
) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    project_uuid = session_config["project_uuid"]
    project_relative_pipeline_path = session_config["pipeline_path"]
    host_project_dir = session_config["project_dir"]
    host_userdir = session_config["host_userdir"]
    session_type = session_type.value

    metadata = {
        "name": f"jupyter-server-{session_uuid}",
        "labels": {
            "app": "jupyter-server",
            "project_uuid": project_uuid,
            "session_uuid": session_uuid,
        },
    }

    volumes_dict, volume_mounts_dict = _get_jupyter_volumes_and_volume_mounts(
        project_uuid, host_userdir, host_project_dir, project_relative_pipeline_path
    )
    deployment_manifest = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": metadata,
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": metadata["labels"]},
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
                        volumes_dict["data"],
                        volumes_dict["jupyterlab-lab"],
                        volumes_dict["jupyterlab-user-settings"],
                    ],
                    "containers": [
                        {
                            "name": metadata["name"],
                            "image": utils.get_jupyter_server_image_to_use(),
                            # K8S_TODO: fix me.
                            "imagePullPolicy": "IfNotPresent",
                            "volumeMounts": [
                                volume_mounts_dict["project-dir"],
                                volume_mounts_dict["pipeline-file"],
                                volume_mounts_dict["data"],
                                volume_mounts_dict["jupyterlab-lab"],
                                volume_mounts_dict["jupyterlab-user-settings"],
                            ],
                            # K8S_TODO: will require changes based on
                            # how ingress is implemented.
                            "args": [
                                "--allow-root",
                                "--port=8888",
                                "--no-browser",
                                (
                                    "--gateway-url="
                                    f"http://jupyter-eg-{session_uuid}:8888/"
                                    f'{metadata["name"]}'
                                ),
                                f"--notebook-dir={_config.PROJECT_DIR}",
                                f'--ServerApp.base_url=/{metadata["name"]}',
                            ],
                            "startupProbe": {
                                "httpGet": {
                                    "path": f'/{metadata["name"]}/api',
                                    "port": 8888,
                                },
                                "periodSeconds": 1,
                                "failureThreshold": 120,
                            },
                            "ports": [{"containerPort": 8888}],
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
            "selector": metadata["labels"],
            # Coupled with the idle check.
            "ports": [{"port": 80, "targetPort": 8888}],
        },
    }

    ingress_manifest = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "Ingress",
        "metadata": metadata,
        "spec": {
            "ingressClassName": "nginx",
            "rules": [
                {
                    "host": _config.ORCHEST_FQDN,
                    "http": {
                        "paths": [
                            {
                                "backend": {
                                    "service": {
                                        "name": f"jupyter-server-{session_uuid}",
                                        "port": {"number": 80},
                                    }
                                },
                                "path": f"/jupyter-server-{session_uuid}",
                                "pathType": "Prefix",
                            }
                        ]
                    },
                }
            ],
        },
    }

    return deployment_manifest, service_manifest, ingress_manifest


def _get_jupyter_enterprise_gateway_rbac_manifests(
    session_uuid: str,
    session_config: SessionConfig,
) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:

    project_uuid = session_config["project_uuid"]
    ns = _config.ORCHEST_NAMESPACE

    role_manifest = {
        "kind": "Role",
        "apiVersion": "rbac.authorization.k8s.io/v1",
        "metadata": {
            "name": f"jupyter-eg-role-{session_uuid}",
            "labels": {
                "app": "jupyter-eg",
                "project_uuid": project_uuid,
                "session_uuid": session_uuid,
            },
        },
        "rules": [
            {
                "apiGroups": [
                    "",
                ],
                "resources": [
                    "pods",
                ],
                "verbs": [
                    "create",
                    "get",
                    "list",
                    "watch",
                    "update",
                    "delete",
                    "patch",
                ],
            }
        ],
    }

    account_manifest = {
        "apiVersion": "v1",
        "kind": "ServiceAccount",
        "metadata": {
            "name": f"jupyter-eg-sa-{session_uuid}",
            "labels": {
                "app": "jupyter-eg",
                "project_uuid": project_uuid,
                "session_uuid": session_uuid,
            },
        },
    }

    rolebinding_manifest = {
        "kind": "RoleBinding",
        "apiVersion": "rbac.authorization.k8s.io/v1",
        "metadata": {
            "name": f"jupyter-eg-rolebinding-{session_uuid}",
            "labels": {
                "app": "jupyter-eg",
                "project_uuid": project_uuid,
                "session_uuid": session_uuid,
            },
        },
        "subjects": [
            {
                "kind": "ServiceAccount",
                "name": f"jupyter-eg-sa-{session_uuid}",
                "namespace": ns,
            }
        ],
        "roleRef": {
            "kind": "Role",
            "name": f"jupyter-eg-role-{session_uuid}",
            "apiGroup": "rbac.authorization.k8s.io",
        },
    }

    return role_manifest, account_manifest, rolebinding_manifest


def _get_jupyter_enterprise_gateway_deployment_service_manifest(
    session_uuid: str,
    session_config: SessionConfig,
    session_type: SessionType,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    project_uuid = session_config["project_uuid"]
    pipeline_uuid = session_config["pipeline_uuid"]
    project_relative_pipeline_path = session_config["pipeline_path"]
    host_project_dir = session_config["project_dir"]
    host_userdir = session_config["host_userdir"]
    session_type = session_type.value

    metadata = {
        "name": f"jupyter-eg-{session_uuid}",
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
        "ORCHEST_HOST_USER_DIR",
        "ORCHEST_HOST_PROJECT_DIR",
        "ORCHEST_HOST_PIPELINE_FILE",
        "ORCHEST_HOST_GID",
        "ORCHEST_SESSION_UUID",
        "ORCHEST_SESSION_TYPE",
        "ORCHEST_GPU_ENABLED_INSTANCE",
        "ORCHEST_REGISTRY",
    ]
    process_env_whitelist.extend(list(user_defined_env_vars.keys()))
    process_env_whitelist = ",".join(process_env_whitelist)

    # Need to reference the ip because the local docker engine will
    # run the container, and if the image is missing it will prompt
    # a pull which will fail because the FQDN can't be resolved by
    # the local engine on the node. K8S_TODO: fix this.
    registry_ip = k8s_core_api.read_namespaced_service(
        _config.REGISTRY, _config.ORCHEST_NAMESPACE
    ).spec.cluster_ip
    environment = {
        "EG_MIRROR_WORKING_DIRS": "True",
        "EG_LIST_KERNELS": "True",
        "EG_KERNEL_WHITELIST": "[]",
        "EG_PROHIBITED_UIDS": "[]",
        "EG_UNAUTHORIZED_USERS": '["dummy"]',
        "EG_UID_BLACKLIST": '["-1"]',
        "EG_ALLOW_ORIGIN": "*",
        "EG_BASE_URL": f"/jupyter-server-{session_uuid}",
        # This is because images might need to be pulled on the node and
        # we aren't using a dameon or similar to pull images on the
        # node.  See kernel-image-puller (KIP) for such an example.
        "EG_KERNEL_LAUNCH_TIMEOUT": "600",
        "EG_ENV_PROCESS_WHITELIST": process_env_whitelist,
        # Note: the docs say to use a string, but the script in charge
        # of launching the kernel will expect an integer and fail!.
        "EG_LOG_LEVEL": "10",
        # "All kernels reside in the EG namespace if true, otherwise
        # KERNEL_NAMESPACE must be provided or one will be created for
        # each kernel."
        "EG_NAMESPACE": _config.ORCHEST_NAMESPACE,
        "EG_SHARED_NAMESPACE": "True",
        "ORCHEST_PIPELINE_UUID": pipeline_uuid,
        "ORCHEST_PIPELINE_PATH": _config.PIPELINE_FILE,
        "ORCHEST_PROJECT_UUID": project_uuid,
        "ORCHEST_HOST_USER_DIR": host_userdir,
        "ORCHEST_HOST_PROJECT_DIR": host_project_dir,
        "ORCHEST_HOST_PIPELINE_FILE": os.path.join(
            host_project_dir, project_relative_pipeline_path
        ),
        "ORCHEST_HOST_GID": os.environ.get("ORCHEST_HOST_GID"),
        "ORCHEST_SESSION_UUID": session_uuid,
        "ORCHEST_SESSION_TYPE": session_type,
        "ORCHEST_GPU_ENABLED_INSTANCE": str(CONFIG_CLASS.GPU_ENABLED_INSTANCE),
        "ORCHEST_REGISTRY": registry_ip,
    }
    environment = [{"name": k, "value": v} for k, v in environment.items()]
    user_defined_env_vars = [
        {"name": key, "value": value} for key, value in user_defined_env_vars.items()
    ]
    environment.extend(user_defined_env_vars)

    volumes_dict, volume_mounts_dict = _get_jupyter_volumes_and_volume_mounts(
        project_uuid, host_userdir, host_project_dir, project_relative_pipeline_path
    )

    deployment_manifest = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": metadata,
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": metadata["labels"]},
            "template": {
                "metadata": metadata,
                "spec": {
                    "securityContext": {
                        "runAsUser": 0,
                        "runAsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                        "fsGroup": int(os.environ.get("ORCHEST_HOST_GID")),
                    },
                    "serviceAccount": f"jupyter-eg-sa-{session_uuid}",
                    "serviceAccountName": f"jupyter-eg-sa-{session_uuid}",
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
                            "ports": [{"containerPort": 8888}],
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
            "selector": metadata["labels"],
            "ports": [{"port": 8888}],
        },
    }
    return deployment_manifest, service_manifest


def _get_user_service_deployment_service_manifest(
    session_uuid: str,
    session_config: SessionConfig,
    service_config: Dict[str, Any],
    session_type: SessionType,
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
    img_mappings = session_config["env_uuid_to_image"]
    session_type = session_type.value

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

        logger.error("Failed to fetch user_env_variables: %s [%s]" % (e, type(e)))

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

    volume_mounts = []
    sbinds = service_config.get("binds", {})
    volumes_dict, volume_mounts_dict = _get_common_volumes_and_volume_mounts(
        host_userdir,
        host_project_dir,
        project_relative_pipeline_path,
    )
    # Can be later extended into adding a Mount for every "custom"
    # key, e.g. key != data and key != project_directory.
    if "/data" in sbinds:
        volume_mounts.append(volume_mounts_dict["data"])
    if "/project-dir" in sbinds:
        volume_mounts.append(volume_mounts_dict["project-dir"])

    # To support orchest environments as services.
    image = service_config["image"]
    prefix = _config.ENVIRONMENT_AS_SERVICE_PREFIX
    if image.startswith(prefix):
        # Need to reference the ip because the local docker engine will
        # run the container, and if the image is missing it will prompt
        # a pull which will fail because the FQDN can't be resolved by
        # the local engine on the node. K8S_TODO: fix this.
        registry_ip = k8s_core_api.read_namespaced_service(
            _config.REGISTRY, _config.ORCHEST_NAMESPACE
        ).spec.cluster_ip

        image = image.replace(prefix, "")
        image = img_mappings[image]
        image = registry_ip + "/" + image

    metadata = {
        "name": service_config["name"] + "-" + session_uuid,
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
            "selector": {"matchLabels": metadata["labels"]},
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
                    ],
                    "containers": [
                        {
                            "name": metadata["name"],
                            "image": image,
                            # K8S_TODO: fix me.
                            "imagePullPolicy": "IfNotPresent",
                            "env": env,
                            "volumeMounts": volume_mounts,
                            "ports": [
                                {"containerPort": port}
                                for port in service_config["ports"]
                            ],
                        }
                    ],
                },
            },
        },
    }

    # K8S_TODO: GUI & data changes to go from entrypoint and command
    # to command and args.
    if "entrypoint" in service_config:
        deployment_manifest["spec"]["template"]["spec"]["containers"][0]["command"] = [
            service_config["entrypoint"]
        ]

    if "command" in service_config:
        deployment_manifest["spec"]["template"]["spec"]["containers"][0]["args"] = [
            service_config["command"]
        ]

    service_manifest = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": metadata,
        "spec": {
            "type": "ClusterIP",
            "selector": metadata["labels"],
            "ports": [{"port": port} for port in service_config["ports"]],
        },
    }

    ingress_url = (
        "service-"
        + service_config["name"]
        + "-"
        + project_uuid.split("-")[0]
        + "-"
        + pipeline_uuid.split("-")[0]
    )
    ingress_paths = []
    for port in service_config.get("ports", []):
        pbp = "pbp-" if service_config.get("preserve_base_path", False) else ""
        ingress_paths.append(
            {
                "backend": {
                    "service": {
                        "name": metadata["name"],
                        "port": {"number": port},
                    }
                },
                "path": f"/{pbp}{ingress_url}_{port}",
                "pathType": "Prefix",
            }
        )

    ingress_manifest = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "Ingress",
        "metadata": metadata,
        "spec": {
            "ingressClassName": "nginx",
            "rules": [
                {
                    "host": _config.ORCHEST_FQDN,
                    "http": {"paths": ingress_paths},
                }
            ],
        },
    }

    return deployment_manifest, service_manifest, ingress_manifest
