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
from typing import List, Set

import aiodocker
import aiohttp

logger = logging.getLogger("IMAGE_DELETER")


async def get_active_environment_images(session: aiohttp.ClientSession) -> Set[str]:
    """Gets the active environment images."""
    endpoint = "http://orchest-api/api/environment-images/active"
    async with session.get(endpoint) as response:
        response_json = await response.json()
        active_images = response_json["active_environment_images"]
    logger.info(f"Found the following active env images: {active_images}")
    return set(active_images)


async def get_env_images_on_node(aiodocker_client) -> List[str]:
    """Gets the environment images on the node."""
    env_images_on_node = []
    for img in await aiodocker_client.images.list():
        names = img.get("RepoTags")
        # Unfortunately RepoTags is mapped to None instead of not being
        # there in some cases.
        names = names if names is not None else []
        for name in names:
            if "orchest-env" in name:
                env_images_on_node.append(name)
    return env_images_on_node


async def run():
    aiodocker_client = aiodocker.Docker()
    try:
        async with aiohttp.ClientSession(trust_env=True) as session:
            while True:
                try:
                    active_env_images = await get_active_environment_images(session)

                    # Find inactive env images on node.
                    env_images_to_remove_from_node = []
                    for img in await get_env_images_on_node(aiodocker_client):
                        if img not in active_env_images:
                            env_images_to_remove_from_node.append(img)
                    env_images_to_remove_from_node = sorted(
                        env_images_to_remove_from_node
                    )
                    logger.info(
                        "Found the following inactive env image on the node: "
                        f"{env_images_to_remove_from_node}, will be removed."
                    )

                    # Remove them.
                    for img in env_images_to_remove_from_node:
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
