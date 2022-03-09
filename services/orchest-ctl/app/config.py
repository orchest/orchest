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
        "auth-server",
        "celery-worker",
        "docker-registry",
        "file-manager",
        "orchest-api",
        "orchest-webserver",
    ]
)

ORCHEST_DEPLOYMENTS = [
    "auth-server",
    "celery-worker",
    "docker-registry",
    "file-manager",
    "orchest-api",
    "orchest-database",
    "orchest-webserver",
    "rabbitmq-server",
    "argo-workflow-argo-workflows-server",
    "argo-workflow-argo-workflows-workflow-controller",
]

DEPLOYMENTS_WITH_ORCHEST_LOG_LEVEL_ENV_VAR = [
    "auth-server",
    "celery-worker",
    "orchest-api",
    "orchest-webserver",
]

DEPLOYMENTS_WITH_CLOUD_ENV_VAR = [
    "auth-server",
    "orchest-webserver",
]

for depl in DEPLOYMENTS_WITH_ORCHEST_LOG_LEVEL_ENV_VAR + DEPLOYMENTS_WITH_CLOUD_ENV_VAR:
    assert depl in ORCHEST_DEPLOYMENTS

WRAP_LINES = 72
# Used to avoid outputting anything that isn't the desired json.
JSON_MODE = False

ORCHEST_CTL_POD_YAML_PATH = "/orchest/deploy/orchest-ctl/pod.yml"
