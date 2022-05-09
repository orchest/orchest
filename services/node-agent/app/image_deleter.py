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
from typing import List, Optional, Set, Tuple

import aiodocker
import aiohttp

from _orchest.internals import config as _config
from _orchest.internals import utils as _utils

logger = logging.getLogger("IMAGE_DELETER")


def is_env_image(name: str) -> bool:
    # Note: due to a k8s_todo, the docker client will return an image
    # name having the form of: <registry ip>/image:tag
    return "orchest-env" in name


def is_custom_jupyter_image(name: str) -> bool:
    return _config.JUPYTER_IMAGE_NAME in name


def is_orchest_image(name: str) -> bool:
    return name.startswith("orchest/")


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
    logger.info(f"Found the following active env images: {active_images}")
    return set(active_images)


async def get_active_custom_jupyter_images(session: aiohttp.ClientSession) -> Set[str]:
    """Gets the active custom jupyter images."""
    endpoint = "http://orchest-api/api/ctl/orchest-images-to-pre-pull"
    async with session.get(endpoint) as response:
        response_json = await response.json()
        pre_pull_images = response_json["pre_pull_images"]
        active_images = [img for img in pre_pull_images if is_custom_jupyter_image(img)]
    logger.info(f"Found the following active jupyter custom images: {active_images}")
    return set(active_images)


async def get_images_of_interest_on_node(
    aiodocker_client,
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

    filters = {
        "label": [
            f"maintainer={_config.ORCHEST_MAINTAINER_LABEL}",
        ]
    }

    for img in await aiodocker_client.images.list(filters=filters):
        names = img.get("RepoTags")
        # Unfortunately RepoTags is mapped to None instead of not being
        # there in some cases.
        names = names if names is not None else []
        for name in names:
            if is_env_image(name):
                env_images_on_node.append(name)
            elif is_custom_jupyter_image(name):
                custom_jupyter_images_on_node.append(name)
            elif is_orchest_image(name):
                orchest_images.append(name)
    return env_images_on_node, custom_jupyter_images_on_node, orchest_images


async def run():
    aiodocker_client = aiodocker.Docker()
    try:
        async with aiohttp.ClientSession(trust_env=True) as session:
            while True:
                try:
                    (
                        env_images_on_node,
                        custom_jupyter_images_on_node,
                        orchest_images_on_node,
                    ) = await get_images_of_interest_on_node(aiodocker_client)
                    env_images_on_node = set(env_images_on_node)
                    custom_jupyter_images_on_node = set(custom_jupyter_images_on_node)
                    orchest_images_on_node = set(orchest_images_on_node)

                    # Find inactive env images on the node.
                    active_env_images = await get_active_environment_images(session)
                    env_images_to_remove_from_node = []
                    for img in env_images_on_node:
                        if img not in active_env_images:
                            env_images_to_remove_from_node.append(img)
                    env_images_to_remove_from_node.sort()
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
                            custom_jupyter_images_to_remove_from_node.append(img)
                    custom_jupyter_images_to_remove_from_node.sort()
                    logger.info(
                        "Found the following inactive custom jupyter images on the "
                        f"node: {custom_jupyter_images_to_remove_from_node}, will be "
                        "removed."
                    )

                    # Find old orchest images on the node.
                    orchest_v = _get_orchest_version()
                    orchest_images_to_remove_from_node = []
                    if orchest_v is not None:
                        logger.info(
                            "Looking for Orchest images which version differs from: "
                            f" {orchest_v}."
                        )
                        for img in orchest_images_on_node:
                            # Doesn't follow the way we version.
                            if "orchest/buildah" in img:
                                continue
                            if ":" not in img:
                                continue

                            name, tag = img.split(":")
                            if _utils.is_version_lt(tag, orchest_v):
                                # Only delete an old image if the up to
                                # date one made it to the node, to avoid
                                # slowing doing updates.
                                if f"{name}:{orchest_v}" in orchest_images_on_node:
                                    orchest_images_to_remove_from_node.append(img)

                    # Remove them.
                    for img in (
                        env_images_to_remove_from_node
                        + custom_jupyter_images_to_remove_from_node
                        + orchest_images_to_remove_from_node
                    ):
                        try:
                            logger.info(f"Deleting {img}.")
                            await aiodocker_client.images.delete(img, force=True)
                        except aiodocker.DockerError as e:
                            logger.error(f"Failed to delete {img}: {e}")
                except Exception as ex:
                    logger.error(ex)
                await asyncio.sleep(60)
    finally:
        await aiodocker_client.close()
