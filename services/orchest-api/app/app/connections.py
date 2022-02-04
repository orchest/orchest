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
k8s_api = k8s_client.CoreV1Api()
k8s_custom_obj_api = k8s_client.CustomObjectsApi()

docker_client = DockerClient.from_env()
# Need to retrieve the ip this way because currently referencing the
# registry as a service (even with a complete path) is not working. Also
# retrieving the ip this way does not work because of permission issues.
# K8S_TODO: fix.
# registry = k8s_api.read_namespaced_service("registry", "kube-system")
# .spec.cluster_ip
registry = "10.111.248.253"
docker_client.login(username="", registry=registry)
