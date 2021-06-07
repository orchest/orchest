"""Module to retrieve information about services.

Service specifications are stored in the corresponding pipeline
definition file e.g. ``pipeline.orchest``.

"""
import copy
from typing import Any, Dict

import requests

from orchest.config import Config
from orchest.error import ServiceNotFound, SessionNotFound, UnrecognizedSessionType
from orchest.utils import get_pipeline


def _get_session_services_specs() -> Dict[str, Any]:

    if Config.SESSION_TYPE == "noninteractive":
        services_specs = get_pipeline().properties.get("services", {})
    elif Config.SESSION_TYPE == "interactive":
        services_specs = _get_interactive_session_services_specs()
    else:
        raise UnrecognizedSessionType()
    return services_specs


def _get_interactive_session_services_specs() -> Dict[str, Any]:
    """Get the session services specs for an interactive session.

    This is necessary because we want to retrieve the specs of the
    current session, and not the specs that are persisted with the
    pipeline definition.
    """
    proj_uuid = Config.PROJECT_UUID
    pp_uuid = Config.PIPELINE_UUID

    resp = requests.get(
        "http://"
        + Config.ORCHEST_API_ADDRESS
        + f"/api/sessions/?project_uuid={proj_uuid}&pipeline_uuid={pp_uuid}"
    )

    sessions = resp.json()
    if not sessions.get("sessions", []):
        raise SessionNotFound()

    return sessions["sessions"][0].get("user_services", {})


def _generate_urls(service) -> Dict[str, Any]:

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
    services_specs = _get_session_services_specs()

    if name in services_specs:
        return _generate_urls(services_specs[name])

    raise ServiceNotFound("Could not find service with name %s" % name)


def get_services() -> Dict[str, Dict[str, Any]]:
    """Gets the services of the pipeline.

    Returns:
        A dictionary of services, mapping service name to service
        description. For an example of a service dictionary, see
        :meth:`get_service`.

    """
    services_specs = _get_session_services_specs()
    services = {}

    for sname, service in services_specs.items():
        services[sname] = _generate_urls(service)

    return services
