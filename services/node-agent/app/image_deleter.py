"""Deletes images that can be deleted from the node.

Currently, only environment images are considered. The orchest-api is
queried to know which images can be deleted. The logic is a simple
loop where:
- active environment images are queried from the orchest-api
- env images on the node are queried through dockerio
- inactive images on the node are deleted
"""
import asyncio
import logging
import os
from typing import List, Optional, Set, Tuple, Union

import aiohttp
from container_runtime import ContainerRuntime

from _orchest.internals import config as _config
from _orchest.internals import utils as _utils

logger = logging.getLogger("IMAGE_DELETER")
logger.setLevel(os.environ["ORCHEST_LOG_LEVEL"])


def is_env_image(name: str) -> bool:
    # Note: due to a k8s_todo, the docker client will return an image
    # name having the form of: <registry ip>/image:tag
    return "orchest-env" in name


def is_custom_jupyter_image(name: str) -> bool:
    return _config.JUPYTER_IMAGE_NAME in name


def is_orchest_image(name: str) -> bool:
    return name.startswith("orchest/") or name.startswith("docker.io/orchest")


def _get_orchest_version() -> Optional[str]:
    v = os.environ.get("ORCHEST_VERSION")
    # Make sure it's not "".
    if not v:
        v = None
    return v


async def get_active_environment_images(session: aiohttp.ClientSession) -> Set[str]:
    """Gets the active environment images."""
    endpoint = "http://orchest-api/api/environment-images/active"
    async with session.get(endpoint) as response:
        response_json = await response.json()
        active_images = response_json["active_environment_images"]
    logger.debug(f"Found the following active env images: {active_images}")
    return set(active_images)


async def get_active_custom_jupyter_images(session: aiohttp.ClientSession) -> Set[str]:
    """Gets the active custom jupyter images."""
    endpoint = "http://orchest-api/api/ctl/active-custom-jupyter-images"
    async with session.get(endpoint) as response:
        response_json = await response.json()
        active_custom_jupyter_images = response_json["active_custom_jupyter_images"]
    logger.debug(
        "Found the following active jupyter custom images: "
        f"{active_custom_jupyter_images}"
    )
    return set(active_custom_jupyter_images)


async def get_images_of_interest_on_node(
    container_runtime: ContainerRuntime,
) -> Tuple[List[str], List[str], List[str]]:
    """Gets the environment images on the node.

    Returns:
        A tuple of lists, where the first list are env images that are
        on the node, the second are custom jupyter images, the third
        are orchest images.
    """
    env_images_on_node = []
    custom_jupyter_images_on_node = []
    orchest_images = []
    for img_name in await container_runtime.list_images():
        if is_env_image(img_name):
            env_images_on_node.append(img_name)
        elif is_custom_jupyter_image(img_name):
            custom_jupyter_images_on_node.append(img_name)
        elif is_orchest_image(img_name):
            orchest_images.append(img_name)
    return env_images_on_node, custom_jupyter_images_on_node, orchest_images


async def has_ongoing_env_build(
    session: aiohttp.ClientSession,
    project_uuid: str,
    environment_uuid: str,
    tag: Optional[Union[int, str]] = None,
) -> bool:
    """Tells if there is an ongoing build for an env image.

    Useful to understand if an image is on the node but not in the
    active set of images because the environment build is still ongoing,
    so the orchest-api still doesn't have the image record.
    """
    if tag is None:
        endpoint = (
            f"http://orchest-api/api/environment-builds/most-recent/"
            f"{project_uuid}/{environment_uuid}"
        )
        async with session.get(endpoint) as response:
            response_json = await response.json()
            builds = response_json["environment_image_builds"]
            if not builds:
                return False
            return builds[0]["status"] == "STARTED"
    else:
        endpoint = (
            f"http://orchest-api/api/environment-builds/{project_uuid}/"
            f"{environment_uuid}/{tag}"
        )
        async with session.get(endpoint) as response:
            if response.status == 404:
                return False
            response_json = await response.json()
            return response_json["status"] == "STARTED"


async def has_ongoing_jupyter_build(session: aiohttp.ClientSession) -> bool:
    """Tells if there is an ongoing build for a jupyter image.

    Useful to understand if an image is on the node but not in the
    active set of images because the build is still ongoing, so the
    orchest-api still doesn't have the image record.
    """
    endpoint = "http://orchest-api/api/jupyter-builds/most-recent/"

    async with session.get(endpoint) as response:
        response_json = await response.json()
        most_recent = response_json["jupyter_image_builds"]
        if not most_recent:
            return False
        return most_recent[0]["status"] == "STARTED"


async def run():
    container_runtime = ContainerRuntime()
    logger.info("Starting image deleter.")
    try:
        async with aiohttp.ClientSession(trust_env=True) as session:
            while True:
                try:
                    (
                        env_images_on_node,
                        custom_jupyter_images_on_node,
                        orchest_images_on_node,
                    ) = await get_images_of_interest_on_node(container_runtime)
                    env_images_on_node = set(env_images_on_node)
                    custom_jupyter_images_on_node = set(custom_jupyter_images_on_node)
                    orchest_images_on_node = set(orchest_images_on_node)

                    # Find inactive env images on the node.
                    active_env_images = await get_active_environment_images(session)
                    env_images_to_remove_from_node = []
                    for img in env_images_on_node:
                        if img not in active_env_images:
                            (
                                proj_uuid,
                                env_uuid,
                                tag,
                            ) = _utils.env_image_name_to_proj_uuid_env_uuid_tag(img)
                            # If True, the image record still has to be
                            # created.
                            if not await has_ongoing_env_build(
                                session, proj_uuid, env_uuid, tag
                            ):
                                env_images_to_remove_from_node.append(img)
                    env_images_to_remove_from_node.sort()
                    if env_images_to_remove_from_node:
                        logger.info(
                            "Found the following inactive env images on the node: "
                            f"{env_images_to_remove_from_node}, will be removed."
                        )

                    # Find inactive custom jupyter images on the node.
                    active_custom_jupyter_images = (
                        await get_active_custom_jupyter_images(session)
                    )
                    custom_jupyter_images_to_remove_from_node = []
                    for img in custom_jupyter_images_on_node:
                        if img not in active_custom_jupyter_images:
                            # If True, the image record still has to be
                            # created.
                            if not await has_ongoing_jupyter_build(session):
                                custom_jupyter_images_to_remove_from_node.append(img)
                    custom_jupyter_images_to_remove_from_node.sort()
                    if custom_jupyter_images_to_remove_from_node:
                        logger.info(
                            "Found the following inactive custom jupyter images on the "
                            f"node: {custom_jupyter_images_to_remove_from_node}, will "
                            "be removed."
                        )

                    # Find old orchest images on the node.
                    orchest_v = _get_orchest_version()
                    orchest_images_to_remove_from_node = []
                    if orchest_v is not None:
                        logger.debug(
                            "Looking for Orchest images which version differs from: "
                            f" {orchest_v}."
                        )
                        for img in orchest_images_on_node:
                            if ":" not in img:
                                continue

                            name, tag = img.split(":")
                            if _utils.is_version_lt(tag, orchest_v):
                                # Only delete an old image if the up to
                                # date one made it to the node, to avoid
                                # slowing doing updates.
                                if f"{name}:{orchest_v}" in orchest_images_on_node:
                                    orchest_images_to_remove_from_node.append(img)

                    # Get the set of active images again. This is to
                    # avoid the following race condition:
                    # - an image is found on the node but not in the
                    #   active set because
                    #   the build is still ongoing
                    # - the build finishes
                    # - the query for the ongoing build tells us that
                    #   there is no build
                    # - the image is added to the images to delete
                    # If the image is not in the latest active images
                    # set it means that the image is really an inactive
                    # image.
                    active_env_images = await get_active_environment_images(session)
                    active_custom_jupyter_images = (
                        await get_active_custom_jupyter_images(session)
                    )
                    active_images = active_env_images.union(
                        active_custom_jupyter_images
                    )

                    # Remove inactive images.
                    for img in (
                        env_images_to_remove_from_node
                        + custom_jupyter_images_to_remove_from_node
                        + orchest_images_to_remove_from_node
                    ):
                        if img not in active_images:
                            if not await container_runtime.delete_image(img):
                                logger.error(f"Failed to delete {img}")
                except Exception as ex:
                    logger.error(ex)
                await asyncio.sleep(60)
    finally:
        await container_runtime.close()
