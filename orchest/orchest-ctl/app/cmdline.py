"""Options for the command line."""
import logging

from docker.types import Mount

import config
from config import (
    DOCKER_NETWORK,
    CONTAINER_MAPPING,
    ALL_IMAGES,
)
from connections import docker_client
from utils import (
    is_install_complete,
    install_images,
    install_network,
    log_server_url,
    clean_containers,
    dev_mount_inject,
)


def get_available_cmds():
    cmds = ["start", "help", "stop", "status", "update"]
    return cmds


def start():
    logging.info("Starting Orchest...")

    # TODO: put this in the right spot
    if config.RUN_MODE == "dev":
        logging.info("Orchest starting in DEV mode. This mounts host directories "
                     "to monitor for source code changes.")

        dev_mount_inject(CONTAINER_MAPPING)

    # check if all images are present
    if is_install_complete():
        # start by cleaning up old containers lingering
        clean_containers()

        # start containers from CONTAINER_MAPPING that haven't started
        running_containers = docker_client.containers.list()

        # NOTE: is the repo tag always the first tag in the Docker Engine API?
        running_container_images = [
            running_container.image.tags[0]
            for running_container in running_containers
            if len(running_container.image.tags) > 0
        ]

        images_to_start = [
            image_name
            for image_name in CONTAINER_MAPPING.keys()
            if image_name not in running_container_images
        ]

        for container_image in CONTAINER_MAPPING.keys():

            if container_image in images_to_start:

                container_spec = CONTAINER_MAPPING[container_image]

                mounts = []
                if 'mounts' in container_spec:
                    mounts = [
                        Mount(
                            target=mount['target'],
                            source=mount['source'],
                            type='bind'
                        )
                        for mount in container_spec['mounts']
                    ]

                environment = container_spec.get('environment', {})
                ports = container_spec.get('ports', {})
                hostname = container_spec.get('hostname')
                command = container_spec.get('command')

                logging.info("Starting image %s" % container_image)

                docker_client.containers.run(
                    image=container_image,
                    command=command,
                    name=container_spec['name'],
                    detach=True,
                    mounts=mounts,
                    network=DOCKER_NETWORK,
                    environment=environment,
                    ports=ports,
                    hostname=hostname,
                )

        log_server_url()

    else:
        logging.info("Installation required. Starting installer.")
        install_images()
        install_network()
        logging.info("Installation finished. Attempting to start...")
        start()


def help():
    cmds = get_available_cmds()

    help_msg = {
        "start": "Starts the Orchest application",
        "help": "Shows this help menu",
        "stop": "Stops the Orchest application",
        "status": "Checks the current status of the Orchest application",
        "update": ("Update Orchest to the latest version by pulling latest "
                   "container images"),
    }

    for cmd in cmds:
        print("{0:20}\t {1}".format(cmd, help_msg[cmd]), flush=True)


def stop():
    # TODO: shutting down can be done easier by just shutting down all the
    #       containers inside the "orchest" docker network.
    # shut down containers
    running_containers = docker_client.containers.list()

    container_names = [
        CONTAINER_MAPPING[container_key]['name']
        for container_key in CONTAINER_MAPPING
    ]

    for running_container in running_containers:
        if (len(running_container.image.tags) and
                running_container.image.tags[0] in ALL_IMAGES):
            # don't kill orchest-ctl itself
            if running_container.image.tags[0] == "orchestsoftware/orchest-ctl:latest":
                continue

            logging.info("Killing container %s" % running_container.name)
            try:
                running_container.kill()
                running_container.remove()
            except Exception as e:
                print(e)
        elif running_container.name in container_names:
            logging.info("Killing container %s" % running_container.name)
            try:
                running_container.kill()
                running_container.remove()
            except Exception as e:
                print(e)


def status():
    running_containers = docker_client.containers.list()

    orchest_container_names = [
        CONTAINER_MAPPING[container_key]['name']
        for container_key in CONTAINER_MAPPING
    ]

    running_prints = ['']
    not_running_prints = ['']

    for container in running_containers:
        if container.name in orchest_container_names:
            running_prints.append("Container %s running." % container.name)
            orchest_container_names.remove(container.name)

    for container_name in orchest_container_names:
        not_running_prints.append("Container %s not running." % container_name)

    if len(running_prints) > 1:
        logging.info('\n'.join(running_prints))

    if len(not_running_prints) > 1:
        logging.info('\n'.join(not_running_prints))


def update():
    logging.info("Updating Orchest...")

    for image in ALL_IMAGES:
        try:
            logging.info("Pulling image `%s` ..." % image)
            docker_client.images.pull(image)
            logging.info("Pulled image `%s`." % image)
        except Exception as e:
            logging.error("Something went wrong while pulling image "
                          "%s error: %s" % (image, e))
