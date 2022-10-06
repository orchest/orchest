"""Pushes images from the node to the registry.

Some environment or custom jupyter images might be on this node and
not in the registry. This can happen, for example:
    - after a build, which results in the image being on the node
    - if the registry storage gets wiped (for whatever reason)

The logic of this module, essentially, does the follow thing:
    - queries the orchest-api for active images that are on this node
        but not in the registry
    - checks what images are on the node through the local container
        runtime
    - the difference between these two sets gets pushed to the registry

"""
import asyncio
import logging
import os
from typing import Set

import aiohttp
from container_runtime import ContainerRuntime, OngoingPushForSameImage

from _orchest.internals import config as _config
from _orchest.internals import utils as _utils
from config import CONFIG_CLASS

logger = logging.getLogger("IMAGE_PUSHER")
logger.setLevel(os.environ["ORCHEST_LOG_LEVEL"])


async def get_environment_images_to_push(session: aiohttp.ClientSession) -> Set[str]:
    """Gets the active environment images to push.

    The pusher consider images that are active, on this node but not
    pushed to the registry as images to push.
    """
    endpoint = (
        "http://orchest-api/api/environment-images/to-push?"
        f"in_node={CONFIG_CLASS.CLUSTER_NODE}"
    )

    async with session.get(endpoint) as response:
        response_json = await response.json()
        active_images = response_json["active_environment_images"]
    logger.debug(f"Found the following active env images to push: {active_images}")
    return set(active_images)


async def get_jupyter_images_to_push(session: aiohttp.ClientSession) -> Set[str]:
    """Gets the active custom jupyter images."""
    endpoint = (
        "http://orchest-api/api/ctl/active-custom-jupyter-images-to-push"
        f"?in_node={CONFIG_CLASS.CLUSTER_NODE}"
    )

    async with session.get(endpoint) as response:
        response_json = await response.json()
        active_images = response_json["active_custom_jupyter_images"]
    logger.debug(
        f"Found the following active custom jupyter images to push: {active_images}"
    )
    return set(active_images)


async def _notify_orchest_api_of_env_image_registry_push(
    session: aiohttp.ClientSession, image: str
) -> None:
    proj_uuid, env_uuid, tag = _utils.env_image_name_to_proj_uuid_env_uuid_tag(image)
    if tag is None:
        raise ValueError(f"Unexpected image without tag: {image}.")
    endpoint = (
        f"http://orchest-api/api/environment-images/{proj_uuid}/{env_uuid}/{tag}/"
        "registry"
    )
    async with session.put(endpoint) as response:
        if response.status != 200:
            raise Exception(
                f"Failed to PUT registry push of {image} to the orchest-api."
            )


async def _notify_orchest_api_of_jupyter_image_registry_push(
    session: aiohttp.ClientSession, image: str
) -> None:
    tag = _utils.jupyter_image_name_to_tag(image)
    endpoint = f"http://orchest-api/api/ctl/jupyter-images/{tag}/registry"
    if tag is None:
        raise ValueError(f"Unexpected image without tag: {image}.")

    async with session.put(endpoint) as response:
        if response.status != 200:
            raise Exception(
                f"Failed to PUT registry push of {image} to the orchest-api."
            )


async def notify_orchest_api_of_registry_push(
    session: aiohttp.ClientSession, image: str
) -> None:
    if "orchest-env" in image:
        await _notify_orchest_api_of_env_image_registry_push(session, image)
    elif _config.JUPYTER_IMAGE_NAME in image:
        await _notify_orchest_api_of_jupyter_image_registry_push(session, image)
    else:
        raise ValueError(f"Invalid image to push: {image}.")


async def _queue_images_to_push(queue: asyncio.Queue, interval: int) -> None:
    async with aiohttp.ClientSession(trust_env=True) as session:
        while True:
            try:
                active_env_images = await get_environment_images_to_push(session)
                active_custom_jupyter_images = await get_jupyter_images_to_push(session)
                for image in active_env_images | active_custom_jupyter_images:
                    logger.info(f"Queuing {image} for registry push.")
                    await queue.put(image)
            except Exception as ex:
                logger.error(ex)
            await asyncio.sleep(interval)


async def _push_image(
    container_runtime: ContainerRuntime, queue: asyncio.Queue
) -> None:
    async with aiohttp.ClientSession(trust_env=True) as session:
        while True:
            try:
                image = await queue.get()
                logger.info("Pushing image to the registry.")
                # Note: the name already includes the registry.
                await container_runtime.push_image(image)

                logger.info("Notifying the `orchest-api` of the push.")
                await notify_orchest_api_of_registry_push(session, image)

            except OngoingPushForSameImage:
                logger.info(f"{image} is already being pushed, skipping task.")
            except Exception as e:
                logger.error(f"Failed to push image, {e}.")
            finally:
                queue.task_done()


async def run(interval: int = 10, threadiness: int = 2) -> None:
    container_runtime = ContainerRuntime()
    logger.info("Starting image pusher.")
    try:
        # maxsize to avoid the queue being filled up with duplicate work
        # and reduce pressure on the orchest-api when not needed.
        queue = asyncio.Queue(maxsize=threadiness)

        get_images_task = asyncio.create_task(_queue_images_to_push(queue, interval))
        pushers = [
            asyncio.create_task(_push_image(container_runtime, queue))
            for _ in range(threadiness)
        ]
        await asyncio.gather(*pushers, get_images_task)
    finally:
        await container_runtime.close()
