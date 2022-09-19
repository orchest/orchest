"""Module to inject scheduling and related changes in k8s resources.

Module to modify scheduling behaviour of all k8s resources that could
involve environment images or custom jupyter images. It uses the fact
that the orchest-api knows that a certain image is on a certain node and
if it has been pushed to the registry already to schedule everything
that is part of the "interactive" scope of Orchest (interactive pipeline
runs, sessions, services, shells, etc.) to nodes that already have the
image to avoid the user waiting for the image to be pulled. The
"non-interactive" scope is less constrained.

For the time being the pre-pull init container is injected in both
interactive and non-interactive scopes, to account for the fact that k8s
GC could remove an image from the node in case of disk pressure.
"""
import json
import random
from typing import Any, Dict, List, Optional, Union

from _orchest.internals import config as _config
from _orchest.internals import utils as _utils
from app import models
from app.connections import db
from config import CONFIG_CLASS


def _nodes_which_have_env_image(
    project_uuid: str, environment_uuid: str, tag: Union[int, str]
) -> List[str]:
    records = models.EnvironmentImageOnNode.query.filter(
        models.EnvironmentImageOnNode.project_uuid == project_uuid,
        models.EnvironmentImageOnNode.environment_uuid == environment_uuid,
        models.EnvironmentImageOnNode.environment_image_tag == int(tag),
    ).all()
    return [record.node_name for record in records]


def _is_env_image_in_registry(
    project_uuid: str, environment_uuid: str, tag: Union[int, str]
) -> bool:
    return db.session.query(
        db.session.query(models.EnvironmentImage)
        .filter(
            models.EnvironmentImage.project_uuid == project_uuid,
            models.EnvironmentImage.environment_uuid == environment_uuid,
            models.EnvironmentImage.tag == (tag),
            models.EnvironmentImage.stored_in_registry.is_(True),
        )
        .exists()
    ).scalar()


def _nodes_which_have_jupyter_image(tag: Union[int, str]) -> List[str]:
    records = models.JupyterImageOnNode.query.filter(
        models.JupyterImageOnNode.jupyter_image_tag == int(tag)
    ).all()
    return [record.node_name for record in records]


def _is_jupyter_image_in_registry(tag: Union[int, str]) -> bool:
    return db.session.query(
        db.session.query(models.JupyterImage)
        .filter(
            models.JupyterImage.tag == int(tag),
            models.JupyterImage.stored_in_registry.is_(True),
        )
        .exists()
    ).scalar()


def _get_node_affinity(node_names: List[str]) -> Dict[str, Any]:
    # Need to set a specific node at the application level:
    # https://github.com/kubernetes/kubernetes/issues/78238.
    return {
        "nodeAffinity": {
            "requiredDuringSchedulingIgnoredDuringExecution": {
                "nodeSelectorTerms": [
                    {
                        "matchFields": [
                            {
                                "key": "metadata.name",
                                "operator": "In",
                                "values": [random.choice(node_names)],
                            }
                        ]
                    }
                ],
            }
        }
    }


def _is_image_of_interest(image: str) -> bool:
    return "orchest-env" in image or _config.JUPYTER_IMAGE_NAME in image


def _should_constrain_to_nodes(scope: str, image_is_in_registry: bool) -> bool:
    # Everything that belongs to the interactive scope is constrained to
    # nodes that already have the image for the sake of getting things
    # to the user quicker. When it comes to the non-interactive scope we
    # only have to constrain to the node that has the image if the image
    # is not in the registry, because that means that there would be no
    # way to pull the image. In all other cases (non-interactive scope
    # with the image being in the registry) we don't need to constrain
    # to nodes.
    return scope == "interactive" or not image_is_in_registry


def _get_required_affinity(
    scope: str,
    image: str,
) -> Optional[Dict[str, Any]]:
    if "orchest-env" in image:
        proj_uuid, env_uuid, tag = _utils.env_image_name_to_proj_uuid_env_uuid_tag(
            image
        )
        if tag is None:
            raise ValueError(f"Unexpected image without tag: {image}.")
        nodes = _nodes_which_have_env_image(proj_uuid, env_uuid, tag)
        image_is_in_registry = _is_env_image_in_registry(proj_uuid, env_uuid, tag)
    elif _config.JUPYTER_IMAGE_NAME in image:
        tag = _utils.jupyter_image_name_to_tag(image)
        if tag is None:
            raise ValueError(f"Unexpected image without tag: {image}.")
        nodes = _nodes_which_have_jupyter_image(tag)
        image_is_in_registry = _is_jupyter_image_in_registry(tag)
    # Pod with images that haven't been built in Orchest do not require
    # special scheduling.
    else:
        return

    if not _should_constrain_to_nodes(scope, image_is_in_registry):
        return

    return _get_node_affinity(nodes)


def _get_pre_pull_init_container_manifest(
    image: str,
) -> Dict[str, Any]:
    return {
        "name": "image-puller",
        "image": _config.CONTAINER_RUNTIME_IMAGE,
        "securityContext": {
            "privileged": True,
            "runAsUser": 0,
        },
        "env": [
            {
                "name": "IMAGE_TO_PULL",
                "value": image,
            },
            {
                "name": "CONTAINER_RUNTIME",
                "value": _config.CONTAINER_RUNTIME,
            },
        ],
        "command": ["/pull_image.sh"],
        "volumeMounts": [
            {
                "name": "container-runtime-socket",
                "mountPath": "/var/run/runtime.sock",
            },
        ],
    }


def modify_kernel_scheduling_behaviour(manifest: Dict[str, Any]) -> None:
    if manifest["kind"] != "Pod":
        raise ValueError("Expected a pod manifest.")
    spec = manifest["spec"]
    if len(spec["containers"]) > 1:
        raise ValueError("Expected a single container in the pod.")
    image = spec["containers"][0]["image"]

    # No special affinity or pre-pull required.
    if not _is_image_of_interest(image):
        return

    init_containers = spec.get("initContainers", [])
    init_containers.append(_get_pre_pull_init_container_manifest(image))
    spec["initContainers"] = init_containers

    required_affinity = _get_required_affinity("interactive", image)
    if required_affinity is not None:
        if spec.get("affinity") is not None:
            raise ValueError("Expected no previously set affinity.")
        spec["affinity"] = required_affinity


def _modify_deployment_pod_scheduling_behaviour(
    scope: str, manifest: Dict[str, Any]
) -> None:
    if manifest["kind"] != "Deployment":
        raise ValueError("Expected a deployment manifest.")
    spec = manifest["spec"]["template"]["spec"]
    if len(spec["containers"]) > 1:
        raise ValueError("Expected a single container in the deployment.")
    image = spec["containers"][0]["image"]

    # No special affinity or pre-pull required.
    if not _is_image_of_interest(image):
        return

    init_containers = spec.get("initContainers", [])
    init_containers.append(_get_pre_pull_init_container_manifest(image))
    spec["initContainers"] = init_containers

    required_affinity = _get_required_affinity(scope, image)
    if required_affinity is not None:
        if spec.get("affinity") is not None:
            raise ValueError("Expected no previously set affinity.")
        spec["affinity"] = required_affinity


def modify_env_shell_scheduling_behaviour(manifest: Dict[str, Any]) -> None:
    _modify_deployment_pod_scheduling_behaviour("interactive", manifest)


def modify_jupyter_server_scheduling_behaviour(manifest: Dict[str, Any]) -> None:
    _modify_deployment_pod_scheduling_behaviour("interactive", manifest)


def modify_user_service_scheduling_behaviour(
    scope: str, manifest: Dict[str, Any]
) -> None:
    _modify_deployment_pod_scheduling_behaviour(scope, manifest)


def _modify_pipeline_scheduling_behaviour_single_node(
    scope: str, manifest: Dict[str, Any]
) -> None:

    templates = manifest["spec"]["templates"]
    if len(templates) > 1:
        raise ValueError("Expected a single template in the workflow.")
    spec = templates[0]
    images = list(
        set([container["image"] for container in spec["containerSet"]["containers"]])
    )

    # ENV_PERF_TODO: modify the pre-pull container to pull multiple
    # images.
    init_containers = spec.get("initContainers", [])
    for i, img in enumerate(images):
        init_container = _get_pre_pull_init_container_manifest(img)
        init_container["name"] += f"-{i}"
        init_containers.append(init_container)
    spec["initContainers"] = init_containers

    # By using only 1 image to specify affinity we are doing a bit of a
    # breach of abstraction, we are "using" the fact that we are in
    # single_node.
    required_affinity = _get_required_affinity(scope, images[0])
    if required_affinity is not None:
        if spec.get("affinity") is not None:
            raise ValueError("Expected no previously set affinity.")
        spec["affinity"] = required_affinity


def _modify_pipeline_scheduling_behaviour_multi_node(
    scope: str, manifest: Dict[str, Any]
) -> None:
    templates = manifest["spec"]["templates"]
    dag_template = None
    step_template = None
    for template in templates:
        if template["name"] == "step":
            step_template = template
        if "dag" in template:
            dag_template = template
    if step_template is None:
        raise ValueError("Expected to find a step template.")
    if dag_template is None:
        raise ValueError("Expected to find a dag template.")

    for step_task in dag_template["dag"]["tasks"]:
        parameters = step_task["arguments"]["parameters"]
        pod_spec_patch = None
        pod_spec_patch_param = None
        image = None
        for param in parameters:
            if param["name"] == "image":
                image = param["value"]
            if param["name"] == "pod_spec_patch":
                pod_spec_patch_param = param
                pod_spec_patch = json.loads(param["value"])
        if image is None:
            raise ValueError("Didn't find any image among the step task parameters.")
        if pod_spec_patch is None:
            raise ValueError(
                "Didn't find any pod spec patch among the step task parameters."
            )

        required_affinity = _get_required_affinity(scope, image)
        if required_affinity is not None:
            if pod_spec_patch.get("affinity") is not None:
                raise ValueError("Expected no previously set affinity.")
            pod_spec_patch["affinity"] = required_affinity

        init_containers = pod_spec_patch.get("initContainers", [])
        init_containers.append(_get_pre_pull_init_container_manifest(image))
        # Quirkness of Argo? The volumes are already defined at the
        # template spec level but if they aren't set in the pod patch
        # the pod spec will be considered invalid.
        pod_spec_patch["volumes"] = manifest["spec"]["volumes"]
        pod_spec_patch["initContainers"] = init_containers
        pod_spec_patch_param["value"] = json.dumps(pod_spec_patch)


def modify_pipeline_scheduling_behaviour(scope: str, manifest: Dict[str, Any]) -> None:
    if manifest["kind"] != "Workflow":
        raise ValueError("Expected a workflow manifest.")
    if CONFIG_CLASS.SINGLE_NODE:
        return _modify_pipeline_scheduling_behaviour_single_node(scope, manifest)
    _modify_pipeline_scheduling_behaviour_multi_node(scope, manifest)
