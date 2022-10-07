from flask_sqlalchemy import SQLAlchemy
from kubernetes import client as k8s_client
from kubernetes import config
from kubernetes.client.api_client import ApiClient
from kubernetes.client.configuration import Configuration
from sqlalchemy import MetaData
from urllib3.util.retry import Retry

from _orchest.internals import config as _config


# Keep in sync with the one in orchest-cli/orchestcli/cmds.py.
def _get_k8s_api_client() -> ApiClient:
    configuration = Configuration.get_default_copy()
    _retry_strategy = Retry(
        total=5,
        backoff_factor=1,
    )
    # See urllib3 poolmanager.py usage of "retries".
    configuration.retries = _retry_strategy
    a = ApiClient(configuration=configuration)
    return a


# This will make it so that constraints and indexes follow a certain
# naming pattern.
metadata = MetaData(naming_convention=_config.database_naming_convention)
db = SQLAlchemy(metadata=metadata)


config.load_incluster_config()
k8s_core_api = k8s_client.CoreV1Api(api_client=_get_k8s_api_client())
k8s_apps_api = k8s_client.AppsV1Api(api_client=_get_k8s_api_client())
k8s_networking_api = k8s_client.NetworkingV1Api(api_client=_get_k8s_api_client())
k8s_custom_obj_api = k8s_client.CustomObjectsApi(api_client=_get_k8s_api_client())
k8s_rbac_api = k8s_client.RbacAuthorizationV1Api(api_client=_get_k8s_api_client())
