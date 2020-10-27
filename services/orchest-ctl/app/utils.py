import logging
import os
import sys

import aiodocker
import asyncio
import docker
from docker.types import Mount
import typer

from app import config
from app.connections import docker_client


def init_logger(verbosity=0):
    """Initialize logger.

    The logging module is used to output to STDOUT for the CLI.

    Args:
        verbosity: The level of verbosity to use. Corresponds to the
        logging levels:
            3 DEBUG
            2 INFO
            1 WARNING
            0 ERROR

    """
    levels = [logging.ERROR, logging.WARNING, logging.INFO, logging.DEBUG]
    logging.basicConfig(level=levels[verbosity])

    root = logging.getLogger()
    if len(root.handlers) > 0:
        h = root.handlers[0]
        root.removeHandler(h)

    formatter = logging.Formatter("%(levelname)s: %(message)s")
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root.addHandler(handler)


def is_orchest_running():
    client = docker.from_env()

    running = False

    for _, spec in config.CONTAINER_MAPPING.items():
        try:
            container = client.containers.get(spec["name"])
            if container.status == "running":
                running = True
                break
        except docker.errors.NotFound:
            pass

    return running


def is_install_complete():
    missing_images = check_images()

    if len(missing_images) > 0:
        logging.warning("Missing images: %s" % missing_images)
        return False

    try:
        docker_client.networks.get(config.DOCKER_NETWORK)
    except docker.errors.NotFound as e:
        logging.warning(
            "Docker network (%s) " "not installed: %s" % (config.DOCKER_NETWORK, e)
        )
        return False

    return True


async def image_exists(image, async_docker):
    try:
        await async_docker.images.get(image)
        return True
    except aiodocker.exceptions.DockerError:
        return False


async def async_check_images(images):
    async_docker = aiodocker.Docker()

    image_exists_result = await asyncio.gather(
        *[image_exists(image, async_docker) for image in images]
    )
    missing_images = [
        images[i] for i in range(len(images)) if not image_exists_result[i]
    ]

    await async_docker.close()
    return missing_images


def check_images():
    loop = asyncio.get_event_loop()
    missing_images = loop.run_until_complete(async_check_images(config.ALL_IMAGES))
    return missing_images


async def pull_image(image, async_docker, force_pull):
    pull = force_pull

    if not pull:
        try:
            await async_docker.images.get(image)
        except aiodocker.exceptions.DockerError:
            pull = True

    if pull:
        typer.echo("Pulling image %s" % image)
        await async_docker.images.pull(image)
        typer.echo("Pulled image %s" % image)


async def pull_images(images, force_pull):
    async_docker = aiodocker.Docker()
    tasks = [pull_image(image, async_docker, force_pull) for image in images]
    await asyncio.wait(tasks)
    await async_docker.close()


def install_images(force_pull=False):
    loop = asyncio.get_event_loop()
    loop.run_until_complete(pull_images(config.ALL_IMAGES, force_pull))


def install_network():
    try:
        docker_client.networks.get(config.DOCKER_NETWORK)
    except docker.errors.NotFound as e:

        typer.echo(
            "Orchest sends an anonymized ping to analytics.orchest.io. "
            "You can disable this by adding "
            '{ "TELEMETRY_DISABLED": true }'
            "to config.json in %s" % config.ENVS["HOST_CONFIG_DIR"]
        )

        logging.info(
            "Docker network %s doesn't exist: %s. "
            "Creating it." % (config.DOCKER_NETWORK, e)
        )
        # Create Docker network named "orchest" with a custom subnet such that
        # containers can be spawned at custom static IP addresses.
        ipam_pool = docker.types.IPAMPool(subnet="172.31.0.0/16")
        ipam_config = docker.types.IPAMConfig(pool_configs=[ipam_pool])
        docker_client.networks.create(
            config.DOCKER_NETWORK, driver="bridge", ipam=ipam_config
        )


def log_server_url():
    orchest_url = get_application_url()
    if len(orchest_url) > 0:
        typer.echo("Orchest is running at: %s" % orchest_url)
    else:
        logging.warning("Orchest is not running.")


def clean_containers():
    running_containers = docker_client.containers.list(all=True)

    for container in running_containers:
        has_tags = len(container.image.tags) > 0
        is_orchest_image = has_tags and container.image.tags[0] in config.ALL_IMAGES
        has_exited = container.status == "exited"
        if is_orchest_image and has_exited:
            logging.info("Removing exited container `%s`" % container.name)
            container.remove()


def get_application_url():
    try:
        docker_client.containers.get("orchest-webserver")
    except Exception as e:
        print(e)
        return ""

    port = config.CONTAINER_MAPPING["orchestsoftware/nginx-proxy:latest"]["ports"][
        "80/tcp"
    ]
    return "http://localhost:%i" % port


def dev_mount_inject(container_spec):
    """Injects mounts to run Orchest in DEV mode.

    The code is mounted at the correct locations inside the containers,
    so that you changes you make to the code are directly reflected in
    the application.

    """
    HOST_REPO_DIR = os.environ.get("HOST_REPO_DIR")

    # orchest-webserver
    orchest_webserver_spec = container_spec["orchestsoftware/orchest-webserver:latest"]
    orchest_webserver_spec["mounts"] += [
        {
            "source": os.path.join(
                HOST_REPO_DIR, "services", "orchest-webserver", "app"
            ),
            "target": "/orchest/services/orchest-webserver/app",
        },
        # Internal library.
        {"source": os.path.join(HOST_REPO_DIR, "lib"), "target": "/orchest/lib"},
    ]

    orchest_webserver_spec["environment"]["FLASK_ENV"] = "development"
    orchest_webserver_spec["command"] = ["./debug.sh"]

    # auth-server
    orchest_auth_server_spec = container_spec["orchestsoftware/auth-server:latest"]
    orchest_auth_server_spec["mounts"] += [
        {
            "source": os.path.join(HOST_REPO_DIR, "services", "auth-server", "app"),
            "target": "/orchest/services/auth-server/app",
        }
    ]

    orchest_auth_server_spec["environment"]["FLASK_APP"] = "main.py"
    orchest_auth_server_spec["environment"]["FLASK_DEBUG"] = "1"
    orchest_auth_server_spec["command"] = [
        "flask",
        "run",
        "--host=0.0.0.0",
        "--port=80",
    ]

    # file-manager
    file_manager_spec = container_spec["orchestsoftware/file-manager:latest"]
    file_manager_spec["mounts"] += [
        {
            "source": os.path.join(HOST_REPO_DIR, "services", "file-manager", "static"),
            "target": "/custom-static",
        },
    ]

    # orchest-api
    orchest_api_spec = container_spec["orchestsoftware/orchest-api:latest"]
    orchest_api_spec["mounts"] += [
        {
            "source": os.path.join(HOST_REPO_DIR, "services", "orchest-api", "app"),
            "target": "/orchest/services/orchest-api/app",
        },
        # Internal library.
        {"source": os.path.join(HOST_REPO_DIR, "lib"), "target": "/orchest/lib"},
    ]
    # Forward the port so that the Swagger API can be accessed at :8080/api
    orchest_api_spec["ports"] = {"80/tcp": 8080}
    orchest_api_spec["environment"]["FLASK_APP"] = "main.py"
    orchest_api_spec["environment"]["FLASK_ENV"] = "development"
    orchest_api_spec["command"] = ["flask", "run", "--host=0.0.0.0", "--port=80"]


def convert_to_run_config(image_name, container_spec):
    # Convert every mount specification to a docker.types.Mount
    mounts = []
    for ms in container_spec.get("mounts", []):
        mount = Mount(target=ms["target"], source=ms["source"], type="bind")
        mounts.append(mount)

    run_config = {
        "image": image_name,
        "command": container_spec.get("command"),
        "name": container_spec["name"],
        "detach": container_spec.get("detach", True),
        "mounts": mounts,
        "network": config.DOCKER_NETWORK,
        "environment": container_spec.get("environment", {}),
        "ports": container_spec.get("ports", {}),
        "hostname": container_spec.get("hostname"),
        "auto_remove": container_spec.get("auto_remove", False),
    }
    return run_config
