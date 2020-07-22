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

DURABLE_QUEUES_DIR = ".orchest/rabbitmq-mnesia"

# Set to `True` if you want to pull images from Dockerhub
# instead of using local equivalents

CONTAINER_MAPPING = {
    "orchestsoftware/orchest-api:latest": {
        "environment": {},
        "command": None,
        "name": "orchest-api",
        "mounts": [
            {
                # Needed for persistent db.
                "source": HOST_USER_DIR,
                "target": "/userdir"
            },
            {
                "source": "/var/run/docker.sock",
                "target": "/var/run/docker.sock"
            },
        ],

    },
    "orchestsoftware/nginx-proxy:latest": {
        "name": "nginx-proxy",
        "ports": {
            "80/tcp": 8000,
            "443/tcp": 443,
        }
    },
    "orchestsoftware/orchest-webserver:latest": {
        "name": "orchest-webserver",
        "environment": {
            "HOST_USER_DIR": HOST_USER_DIR,
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
            },
            {
                # Mount in needed for copying the snapshot dir to
                # pipeline run dirs for experiments.
                "source": HOST_USER_DIR,
                "target": "/userdir"
            },
        ]
    },
    "rabbitmq:3": {
        "name": "rabbitmq-server",
        "hostname": "rabbitmq-hostname",
        "mounts": [
            {
                # Persisting RabbitMQ Queues.
                "source": os.path.join(HOST_USER_DIR, DURABLE_QUEUES_DIR),
                "target": "/var/lib/rabbitmq/mnesia",
            }
        ],
    }
}

# TODO: shutting down can be done easier by just shutting down all the
#       containers inside the "orchest" docker network.
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
    "orchestsoftware/memory-server:latest",
]


def clean_containers():
    client = docker.from_env()

    running_containers = client.containers.list(all=True)

    for container in running_containers:
        if len(container.image.tags) > 0 and \
           container.image.tags[0] in IMAGES and \
           container.status == "exited":
            logging.info("Removing exited container `%s`" % container.name)
            container.remove()


def start():
    logging.info("Starting Orchest...")

    # check if all images are present
    if install_complete():
        client = docker.from_env()

        # start by cleaning up old containers lingering
        clean_containers()

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

                environment = container_spec.get('environment', {})
                ports = container_spec.get('ports', {})
                hostname = container_spec.get('hostname')
                command = container_spec.get('command')

                logging.info("Starting image %s" % container_image)

                client.containers.run(
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
            client.images.get(image)
        except docker.errors.ImageNotFound as e:
            logging.info("Pulling image `%s` ..." % image)
            client.images.pull(image)
            logging.info("Pulled image `%s`." % image)


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

    logging.info("Orchest starting in DEV mode. This mounts host directories to monitor for source code changes.")


    # orchest-webserver dev mount
    orchest_webserver_spec = CONTAINER_MAPPING["orchestsoftware/orchest-webserver:latest"]
    orchest_webserver_spec['mounts'] += [
        {
            "source": os.path.join(
                os.environ.get("HOST_PWD"), 
                "orchest", 
                "orchest-webserver", 
                "app"),
            "target": "/app" 
        }
    ]

    orchest_webserver_spec['environment']["FLASK_APP"] = "main.py"
    orchest_webserver_spec['environment']["FLASK_DEBUG"] = "1"
    orchest_webserver_spec['command'] = [
       "flask",
       "run",
       "--host=0.0.0.0",
       "--port=80"
    ]

    # orchest-api dev mount
    orchest_api_spec = CONTAINER_MAPPING["orchestsoftware/orchest-api:latest"]
    orchest_api_spec["mounts"] += [
        {
            "source": os.path.join(
                os.environ.get("HOST_PWD"),
                "orchest",
                "orchest-api",
                "app",
                "app"),
            "target": "/app/app"
        }
    ]
    orchest_api_spec["ports"] = {
        "80/tcp": 8080
    }
    orchest_api_spec["environment"]["FLASK_APP"] = "main.py"
    orchest_api_spec["environment"]["FLASK_ENV"] = "development"
    orchest_api_spec["command"] = [
       "flask",
       "run",
       "--host=0.0.0.0",
       "--port=80"
    ]

    

def status():

    # view conntainer status
    client = docker.from_env()

    # shut down containers
    running_containers = client.containers.list()

    orchest_container_names = [CONTAINER_MAPPING[container_key]['name'] for container_key in CONTAINER_MAPPING]

    running_prints = ['']
    not_running_prints = ['']

    for container in running_containers:
        if container.name in orchest_container_names:
            running_prints.append("Container %s running." % container.name)
            orchest_container_names.remove(container.name)

    for container_name in orchest_container_names:
        not_running_prints.append("Container %s not running." % container_name)


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
            logging.info("Pulling image `%s` ..." % image)
            client.images.pull(image)
            logging.info("Pulled image `%s`." % image)
        except Exception as e:
            logging.error("Something went wrong while pulling image %s error: %s" % (image, e))



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
