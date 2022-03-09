from enum import Enum

ORCHEST_NAMESPACE = "orchest"

STATUS_CHANGING_OPERATIONS = ["install", "start", "stop", "restart", "update"]


class OrchestStatus(str, Enum):
    INSTALLING = "installing"
    RESTARTING = "restarting"
    RUNNING = "running"
    STARTING = "starting"
    STOPPED = "stopped"
    STOPPING = "stopping"
    UNHEALTHY = "unhealthy"
    UPDATING = "updating"


ORCHEST_OPERATION_TO_STATUS_MAPPING = {
    "install": OrchestStatus.INSTALLING,
    "start": OrchestStatus.STARTING,
    "stop": OrchestStatus.STOPPING,
    "restart": OrchestStatus.RESTARTING,
    "update": OrchestStatus.UPDATING,
}


DEPLOYMENT_VERSION_SYNCED_WITH_CLUSTER_VERSION = set(
    [
        "celery-worker",
        "docker-registry",
        "file-manager",
        "orchest-api",
        "orchest-webserver",
    ]
)

ORCHEST_DEPLOYMENTS = [
    "celery-worker",
    "docker-registry",
    "file-manager",
    "orchest-api",
    "orchest-database",
    "orchest-webserver",
    "rabbitmq-server",
    # Bit risky in chase of a name change? K8S_TODO: discuss.
    "argo-workflow-argo-workflows-server",
    "argo-workflow-argo-workflows-workflow-controller",
]

WRAP_LINES = 72
# Used to avoid outputting anything that isn't the desired json.
JSON_MODE = False

ORCHEST_CTL_POD_YAML_PATH = "/orchest/deploy/orchest-ctl/pod.yml"
