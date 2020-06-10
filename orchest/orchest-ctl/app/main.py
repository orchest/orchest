import logging
import sys
import pprint
import docker
import os
import re

from docker.types import Mount


VALID_COMMANDS = {
    "start": "Starts the Orchest application",
    "help": "Shows this help menu",
    "stop": "Stops the Orchest application",
    "status": "Checks the current status of the Orchest application",
    "update": "Update Orchest to the latest version by pulling latest container images"
}


DOCKER_NETWORK = 'orchest'

if "HOST_USER_DIR" in os.environ:
    HOST_USER_DIR = os.environ.get("HOST_USER_DIR")
else:
    raise("Need to set HOST_USER_DIR!")

if "HOST_CONFIG_DIR" in os.environ:
    HOST_CONFIG_DIR = os.environ.get("HOST_CONFIG_DIR")
else:
    raise("Need to set HOST_CONFIG_DIR!")


# for Windows convert backslashes (\) to forward slashes (/) to make Docker Engine API work
def capture_drive(match):
     return '/host_mnt/' + match.group(1).lower() + '/'

def slash_sub(path):
    return re.sub(r'([A-Z]):\\', capture_drive, path).replace("\\","/")

HOST_USER_DIR = slash_sub(HOST_USER_DIR)
HOST_CONFIG_DIR = slash_sub(HOST_CONFIG_DIR)

# Set to `True` if you want to pull images from Dockerhub 
# instead of using local equivalents

CONTAINER_MAPPING = {
    "orchestsoftware/orchest-api:latest": {
        "name": "orchest-api",
        "mounts": [
            {
                "source": "/var/run/docker.sock",
                "target": "/var/run/docker.sock"
            },
        ]
    },
    "orchestsoftware/nginx-proxy:latest": {
        "name": "nginx-proxy",
        "ports": {
            "80/tcp": 8000
        }
    },
    "orchestsoftware/orchest-webserver:latest": {
        "name": "orchest-webserver",
        "environment": {
            "HOST_USER_DIR": HOST_USER_DIR
        },
        "mounts": [
            {
                "source": "/var/run/docker.sock",
                "target": "/var/run/docker.sock"
            },
            {
                "source": HOST_USER_DIR,
                "target": "/userdir"
            },
            {
                "source": HOST_CONFIG_DIR,
                "target": "/config"
            }
        ],
    },
    "orchestsoftware/celery-worker:latest": {
        "name": "celery-worker",
        "mounts": [
            {
                "source": "/var/run/docker.sock",
                "target": "/var/run/docker.sock"
            }
        ]
    },
    "rabbitmq:3": {
        "name": "rabbitmq-server"
    }
}

# images in CONTAINER_MAPPING need to be run in the application on start
# additional images below are necessary for dynamically creating containers
# in Orchest for the pipeline steps / Jupyter server / Enterprise Gateway

IMAGES = list(CONTAINER_MAPPING.keys())
IMAGES += [
    "elyra/enterprise-gateway:2.1.1", 
    "orchestsoftware/jupyter-server:latest",
    "orchestsoftware/r-notebook-augmented:latest",
    "orchestsoftware/r-notebook-runnable:latest",
    "orchestsoftware/scipy-notebook-runnable:latest",
    "orchestsoftware/scipy-notebook-augmented:latest",
    "orchestsoftware/custom-base-kernel-py:latest",
    "orchestsoftware/custom-base-kernel-r:latest",
]


def start():
    logging.info("Starting Orchest...")

    # check if all images are present
    if install_complete():
        client = docker.from_env()
        
        # start containers from CONTAINER_MAPPING that haven't started
        running_containers = client.containers.list()

        # NOTE: is the repo tag always the first tag in the Docker Engine API?
        running_container_images = [
            running_container.image.tags[0] for running_container in running_containers if len(running_container.image.tags) > 0
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

                environment = {}
                if 'environment' in container_spec:
                    environment = container_spec['environment']

                ports = {}
                if 'ports' in container_spec:
                    ports = container_spec['ports']
                
                logging.info("Starting image %s" % container_image)

                client.containers.run(
                    image=container_image,
                    name=container_spec['name'],
                    detach=True,
                    mounts=mounts,
                    network=DOCKER_NETWORK,
                    environment=environment,
                    ports=ports
                )

        log_server_url()

    else:
        logging.info("Installation required. Starting installer.")
        install_images()
        install_network()
        logging.info("Installation finished. Attempting to start...")
        start()


def install_network():

    docker_client = docker.from_env()

    try:
        docker_client.networks.get(DOCKER_NETWORK)
    except docker.errors.NotFound as e:

        logging.info("Docker network %s doesn't exist: %s. Creating it." % (DOCKER_NETWORK, e))
        # Create Docker network named "orchest" with a custom subnet such that
        # containers can be spawned at custom static IP addresses.
        ipam_pool = docker.types.IPAMPool(subnet='172.31.0.0/16')
        ipam_config = docker.types.IPAMConfig(pool_configs=[ipam_pool])
        docker_client.networks.create(
            DOCKER_NETWORK,
            driver="bridge",
            ipam=ipam_config
        )


def install_complete():

    docker_client = docker.from_env()

    missing_images = check_images()
    
    if len(missing_images) > 0:
        logging.warning("Missing images: %s" % missing_images)
        return False

    try:
        docker_client.networks.get(DOCKER_NETWORK)
    except docker.errors.NotFound as e:
        logging.warning("Docker network (%s) not installed: %s" % (DOCKER_NETWORK, e))
        return False

    return True


def check_images():

    client = docker.from_env()

    missing_images = []

    for image in IMAGES:
        try:
            client.images.get(image)
            # logging.info("Image `%s` is installed." % image)
        except docker.errors.ImageNotFound as e:
            missing_images.append(image)
        except docker.errors.APIError as e:
            raise e
    
    return missing_images


def install_images():
    
    client = docker.from_env()

    for image in IMAGES:
        try:
            try:
                client.images.get(image)
            except docker.errors.ImageNotFound as e:
                logging.info("Pulling image `%s` ..." % image)
                client.images.pull(image)
                logging.info("Pulled image `%s`." % image)
        except Exception as e:
            raise(e)


def get_application_url():

    client = docker.from_env()

    try:
        # raise Exception if not found
        client.containers.get("orchest-webserver")
        
        return "http://localhost:8000"
        
    except Exception as e:
        print(e)
        return ""


def help_func():
    for key in VALID_COMMANDS:
        print("{0:20}\t {1}".format(key, VALID_COMMANDS[key]), flush=True)


def stop():
    client = docker.from_env()

    # shut down containers
    running_containers = client.containers.list()

    container_names = [CONTAINER_MAPPING[container_key]['name'] for container_key in CONTAINER_MAPPING]

    for running_container in running_containers:
        if len(running_container.image.tags) > 0 and running_container.image.tags[0] in IMAGES:
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


def log_server_url():
    orchest_url = get_application_url()
    if len(orchest_url) > 0:
        logging.info("Orchest is running at: %s" % orchest_url)
    else:
        logging.warning("Orchest is not running.")


def dev_mount_inject():

    CONTAINER_MAPPING["orchestsoftware/orchest-webserver:latest"]['mounts'] += [
        {
            "source": os.path.join(os.environ.get("HOST_PWD"), "orchest", "orchest-webserver", "app"),
            "target": "/app"
        }
    ]


def status():

    # view conntainer status
    client = docker.from_env()

    # shut down containers
    running_containers = client.containers.list()

    running_container_images = [
        running_container.image.tags[0] for running_container in running_containers if len(running_container.image.tags) > 0
    ]

    running_prints = ['']
    not_running_prints = ['']

    for image in IMAGES:
        if image in running_container_images:
            running_prints.append("Container image `%s` running." % image)
        else:
            not_running_prints.append("Container image `%s` NOT running." % image)

    logging.info('\n'.join(running_prints))
    logging.info('\n'.join(not_running_prints))

    log_server_url()


def init_logger():
    logging.basicConfig(level=logging.INFO)

    root = logging.getLogger()
    if len(root.handlers) > 0:
        h = root.handlers[0]
        root.removeHandler(h)

    formatter = logging.Formatter(logging.BASIC_FORMAT)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root.addHandler(handler)


def update():
    logging.info("Updating Orchest...")

    client = docker.from_env()

    for image in IMAGES:
        try:
            try:
                logging.info("Pulling image `%s` ..." % image)
                client.images.pull(image)
                logging.info("Pulled image `%s`." % image)
            except Exception as e:
                logging.error("Something went wrong while pulling image %s error: %s" % (image, e))

        except Exception as e:
            raise(e)


def main():

    init_logger()

    command_to_func = {
        "start": start,
        "help": help_func,
        "stop": stop,
        "status": status,
        "update": update
    }

    # default command
    command = "help"

    if len(sys.argv) > 1:
        command = sys.argv[1]

    if len(sys.argv) > 2:
        if sys.argv[2] == "dev":
            dev_mount_inject()

    if command not in VALID_COMMANDS.keys():
        logging.error("Command `%s` is not supported." % command)
        help_func()
        return

    
    command_to_func[command]()


if __name__ == '__main__':

    # execute only if run as a script
    main()
