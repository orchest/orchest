from docker.client import DockerClient
from flask_sqlalchemy import SQLAlchemy
from kubernetes import client as k8s_client
from kubernetes import config
from sqlalchemy import MetaData

from _orchest.internals import config as _config

# TODO: we should check whether it is possible for the docker client to
#       expire. Since users could have their pipeline running for
#       several hours.
# TODO: what happens to the connections when the app closes? Do they get
#       closed? Do we need to include something like a graceful
#       shutdown?

# this will make it so that constraints and indexes follow a certain
# naming pattern
metadata = MetaData(naming_convention=_config.database_naming_convention)
db = SQLAlchemy(metadata=metadata)


config.load_incluster_config()
k8s_core_api = k8s_client.CoreV1Api()
k8s_apps_api = k8s_client.AppsV1Api()
k8s_custom_obj_api = k8s_client.CustomObjectsApi()
k8s_rbac_api = k8s_client.RbacAuthorizationV1Api()

docker_client = DockerClient.from_env()
