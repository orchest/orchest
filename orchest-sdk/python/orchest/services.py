"""Module to retrieve information about services.

Service specifications are stored in the corresponding pipeline
definition file e.g. ``pipeline.orchest``.

"""
import json
from typing import Dict, List

from orchest.config import Config
from orchest.error import ServiceNotFound
from orchest.pipeline import Pipeline


def _get_pipeline() -> Pipeline:
    with open(Config.PIPELINE_DEFINITION_PATH, "r") as f:
        pipeline_definition = json.load(f)
    return Pipeline.from_json(pipeline_definition)


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


def get_service(name) -> Dict:
    """Gets the service of the pipeline.

    Returns:
        A service. THe service contains the following:

        {"internal_urls": [], "external_urls": [],
            ... user specified service fields}

        one for each port specified in the service specification.
    """
    pipeline = _get_pipeline()

    for service in pipeline.properties.get("services"):
        if service["name"] == name:
            return _generate_urls(service, pipeline)

    raise ServiceNotFound("Could not find service with name %s" % name)


def get_services() -> List:
    """Gets the services of the pipeline.

    Returns:
        A list of services. Each service contains the following:

        {"internal_urls": [], "external_urls": [],
            ... user specified service fields}

        one for each port specified in the service specification.
    """
    pipeline = _get_pipeline()

    services = []

    for service in pipeline.properties.get("services"):
        services.append(_generate_urls(service, pipeline))

    return services
