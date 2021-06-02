"""Module to retrieve information about services.

Service specifications are stored in the corresponding pipeline
definition file e.g. ``pipeline.orchest``.

"""
from typing import Any, Dict, List

from orchest.config import Config
from orchest.error import ServiceNotFound
from orchest.utils import get_pipeline


def _generate_urls(service, pipeline):

    service_uuid = pipeline.properties["uuid"]

    if Config.RUN_UUID is not None:
        service_uuid = Config.RUN_UUID

    path = (
        "/service-"
        + service["name"]
        + "-"
        + Config.PROJECT_UUID.split("-")[0]
        + "-"
        + service_uuid.split("-")[0]
        + "_"
        + "{port}"
    )

    service["internal_urls"] = [
        (
            "http://service-"
            + service["name"]
            + "-"
            + Config.PROJECT_UUID.split("-")[0]
            + "-"
            + service_uuid.split("-")[0]
            + ":"
            + str(port)
            + path.format(port=port)
        )
        for port in service.get("ports", [])
    ]

    service["external_urls"] = [
        path.format(port=port) for port in service.get("ports", [])
    ]

    return service


def get_service(name) -> Dict[str, List[Any]]:
    """Gets the service of the pipeline by name.

    Returns:
        A dictionary describing a service.

        Example::

            {
                "internal_urls": [],
                "external_urls": [],
                ... # user specified service fields
            }

        where each port specified in the service specification
        constitutes to one element in the lists.

    Raises:
        ServiceNotFoundError: The service given by name ``name``
            could not be found.

    """
    pipeline = get_pipeline()

    services = pipeline.properties.get("services", {})
    if name in services:
        return _generate_urls(services[name], pipeline)

    raise ServiceNotFound("Could not find service with name %s" % name)


def get_services() -> Dict[str, Dict[str, List[Any]]]:
    """Gets the services of the pipeline.

    Returns:
        A dictionary of services, mapping service name to service
        description. For an example of a service dictionary, see
        :meth:`get_service`.

    """
    pipeline = get_pipeline()

    services = {}

    for service in pipeline.properties.get("services", {}):
        services[service["name"]] = _generate_urls(service, pipeline)

    return services
