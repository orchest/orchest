"""Module to interact with the registry.

Functions aren't a 1:1 mapping to the OCI API specs, but an abstracted
version of what we actually need.
"""

from typing import List, Optional

import requests
from kubernetes import stream

from _orchest.internals import config as _config
from app import errors, utils
from app.connections import k8s_core_api
from config import CONFIG_CLASS

logger = utils.get_logger()

_VERIFY = CONFIG_CLASS.REGISTRY_TLS_CERT_BUNDLE


def get_list_of_repositories() -> List[str]:
    """Gets all repositories in the registry.

    At the moment this means environments and the user configured
    jupyter image.
    """
    repos = []
    batch_size = 50
    next = f"/v2/_catalog?n={batch_size}"
    while next is not None:
        resp = requests.get(f"{CONFIG_CLASS.REGISTRY_ADDRESS}{next}", verify=_VERIFY)
        repos.extend(resp.json().get("repositories", []))
        next = resp.links.get("next", {}).get("url")
    return repos


def get_tags_of_repository(repository: str) -> List[str]:
    """Gets all the tags of a repository."""
    tags = []
    batch_size = 50
    next = f"/v2/{repository}/tags/list?n={batch_size}"
    while next is not None:
        resp = requests.get(f"{CONFIG_CLASS.REGISTRY_ADDRESS}{next}", verify=_VERIFY)
        # The "tags" entry can be missing if the repository has just
        # been created, None if there are no tags, or a list of strings.
        tags_batch = resp.json().get("tags", [])
        tags_batch = tags_batch if tags_batch is not None else []
        tags.extend(tags_batch)
        next = resp.links.get("next", {}).get("url")
    return tags


def get_manifest(repository: str, tag: str) -> List[str]:
    """Gets the manifest of a tag.

    Can be used, for example, to calculate total size of an image.
    """
    r = requests.get(
        f"{CONFIG_CLASS.REGISTRY_ADDRESS}/v2/{repository}/manifests/{tag}",
        verify=_VERIFY,
        headers={"Accept": "application/vnd.docker.distribution.manifest.v2+json"},
    )
    return r.json()


def get_manifest_digest(repository: str, tag: str) -> Optional[str]:
    """Gets the digest of a manifest.

    Can be used, for example, in other registry API endpoints.
    """
    # From the docs: When deleting a manifest from a registry version
    # 2.3 or later, the following header must be used when HEAD or
    # GET-ing the manifest to obtain the correct digest to delete.
    resp = requests.head(
        f"{CONFIG_CLASS.REGISTRY_ADDRESS}/v2/{repository}/manifests/{tag}",
        verify=_VERIFY,
        headers={"Accept": "application/vnd.docker.distribution.manifest.v2+json"},
    )
    digest = resp.headers.get("Docker-Content-Digest")
    return digest


def delete_image_by_digest(
    repository: str, digest: str, run_garbage_collection: bool
) -> None:
    """Delete an image by digest.

    All tags pointing to this digest are deleted. This function should
    be used when deleting a given tagged image, because doing that
    directly it's not possible, see:
    https://github.com/distribution/distribution/issues/1566. Note that
    different tags could be backed by the same digest, meaning that
    such deletion could end up deleting multiple tags.
    """
    resp = requests.delete(
        f"{CONFIG_CLASS.REGISTRY_ADDRESS}/v2/{repository}/manifests/{digest}",
        verify=_VERIFY,
    )
    if resp.status_code not in [200, 202, 404]:
        raise errors.ImageRegistryDeletionError(resp)

    if run_garbage_collection:
        run_registry_garbage_collection()


def run_registry_garbage_collection(repositories: Optional[List[str]] = None) -> None:
    """Runs the registry garbage collection process.

    Docs: https://docs.docker.com/registry/garbage-collection/
    This is necessary because deleting an image through the API is akin
    to deleting a reference, the actual image (layers) on the FS will
    still be there, and a GC run is necessary to - potentially - delete
    them.

    We rely on the registry pointing to a non existent REDIS instance
    for its cache to avoid the following issue:
    https://github.com/distribution/distribution/issues/1803, this
    makes it possible to run GC without having to restart the registry
    to clean the cache.

    This function should be called only when having the certainty that
    no images are being pushed to the registry to avoid race conditions.
    This is currently accomplished by calling it from a celery task part
    of the "builds" queue.
    """
    if repositories is None:
        repositories = []

    pods = k8s_core_api.list_namespaced_pod(
        _config.ORCHEST_NAMESPACE, label_selector="app=docker-registry"
    )
    for pod in pods.items:
        logger.info(f"Running garbage collection in pod: {pod.metadata.name}.")
        resp = stream.stream(
            k8s_core_api.connect_get_namespaced_pod_exec,
            pod.metadata.name,
            _config.ORCHEST_NAMESPACE,
            command=[
                "./bin/registry",
                "garbage-collect",
                "/etc/docker/registry/config.yml",
                "--delete-untagged",
            ],
            stderr=True,
            stdin=False,
            stdout=True,
            tty=False,
        )
        logger.info(str(resp))

        # Sadly running the docker-registry GC is not enough.
        for repo in repositories:
            logger.info(
                f"Deleting repo {repo} from pod {pod.metadata.name} file system."
            )
            resp = stream.stream(
                k8s_core_api.connect_get_namespaced_pod_exec,
                pod.metadata.name,
                _config.ORCHEST_NAMESPACE,
                command=[
                    "rm",
                    "-rf",
                    f"/var/lib/registry/docker/registry/v2/repositories/{repo}",
                ],
                stderr=True,
                stdin=False,
                stdout=True,
                tty=False,
            )
            logger.info(str(resp))
