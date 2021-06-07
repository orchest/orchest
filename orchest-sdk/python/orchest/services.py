"""Module to retrieve information about services.

Service specifications are stored in the corresponding pipeline
definition file e.g. ``pipeline.orchest``.

"""
import copy
from typing import Any, Dict

from orchest.config import Config
from orchest.error import ServiceNotFound
from orchest.utils import get_pipeline


def _generate_urls(service, pipeline):

    session_uuid = Config.SESSION_UUID

    service = copy.deepcopy(service)
    service.pop("scope", None)

    container_name = (
        ("internal-" if not service.get("ports", []) else "")
        + "service-"
        + service["name"]
        + "-"
        + Config.PROJECT_UUID.split("-")[0]
        + "-"
        + session_uuid.split("-")[0]
    )

    external_urls = {}
    base_paths = {}
    for port in service.get("ports", []):
        pbp = "pbp-" if service.get("preserve_base_path", False) else ""
        base_path = f"/{pbp}{container_name}_{port}"
        external_url = f"http://{{host_name}}:{{port}}{base_path}/"

        base_paths[port] = base_path
        external_urls[port] = external_url

    service["internal_hostname"] = container_name
    service["external_urls"] = external_urls
    service["base_paths"] = base_paths

    return service


def get_service(name) -> Dict[str, Any]:
    """Gets the service of the pipeline by name.

    Returns:
        A dictionary describing a service.

        Example::

            {
                "internal_url": service-<service-name>-<identifier>,
                "external_urls": {
                    80: "http://{host_name}:{port}/service"
                    "-<service-name>-<identifier>_80"
                }
                "base_paths": {
                    80: "/service-<service-name>-<identifier>_80"
                }
                ... # user specified service fields
            }

        where each port specified in the service specification
        constitutes to one element in the external_urls and base_paths
        mappings, that map port to external urls and ports to base paths
        respectively.

    Raises:
        ServiceNotFoundError: The service given by name ``name``
            could not be found.

    """
    pipeline = get_pipeline()

    services = pipeline.properties.get("services", {})
    if name in services:
        return _generate_urls(services[name], pipeline)

    raise ServiceNotFound("Could not find service with name %s" % name)


def get_services() -> Dict[str, Dict[str, Any]]:
    """Gets the services of the pipeline.

    Returns:
        A dictionary of services, mapping service name to service
        description. For an example of a service dictionary, see
        :meth:`get_service`.

    """
    pipeline = get_pipeline()

    services = {}

    for sname, service in pipeline.properties.get("services", {}).items():
        services[sname] = _generate_urls(service, pipeline)

    return services
