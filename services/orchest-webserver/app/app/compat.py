from typing import Any, Dict, List, Optional, Tuple

"""Provides a simple migration layer for pipeline jsons.

Given a pipeline version, a mapping will be used to establish if the
pipeline should be migrated, that is, modified in place, until it is
brought to the latest version used in Orchest.

If you are to implement a new migration add another _migrate_...
function following the given convention: 1.0.0 -> _migrate_1_0_0. Then
add a mapping to the "_version_to_migration_function" dictionary to
map the current version to the migration function and the version to
which it will migrate.

Note that the system only supports forward migrations.

"""
from _orchest.internals import utils as _utils


def _migrate_1_0_0(pipeline: dict) -> None:
    """Pre-k8s migrations"""

    # Take care of old pipelines with no defined params.
    if "parameters" not in pipeline:
        pipeline["parameters"] = {}

    # Pipelines had no constraints related to env var names.
    services = pipeline.get("services", {})
    for service in services.values():
        env_variables = service.get("env_variables", {})

        if not _utils.are_environment_variables_valid(env_variables):
            tmp = {}
            for key, value in env_variables.items():
                valid_key = _utils.make_env_var_name_valid(key)

                # Do not lose variables to collisions.
                i = 2
                while valid_key in tmp:
                    valid_key = f"{valid_key}_{i}"
                    i += 1
                tmp[valid_key] = value
            service["env_variables"] = tmp

        env_vars_inherit = service.get("env_variables_inherit", [])
        tmp = set()
        for var in env_vars_inherit:
            valid_var = _utils.make_env_var_name_valid(var)
            i = 2
            while valid_var in tmp:
                valid_var = f"{valid_var}_{i}"
                i += 1
            tmp.add(valid_var)
        service["env_variables_inherit"] = list(tmp)

    for step in pipeline["steps"].values():
        if (
            "kernel" in step
            and "name" in step["kernel"]
            and step["kernel"]["name"] == "ir"
        ):
            step["kernel"]["name"] = "r"


def _migrate_1_1_0(pipeline: dict) -> None:
    """Migrate from pre-k8s to k8s."""

    services = pipeline.get("services", {})
    for service in services.values():
        # Can't use a get() with a default value because it would imply
        # a different thing. Migrate from pre-k8s to k8s.
        if "entrypoint" in service:
            if "command" in service:
                service["args"] = service["command"]
                del service["command"]

            service["command"] = service["entrypoint"]
            del service["entrypoint"]

        if not service.get("ports", []):
            service["ports"] = [8080]

        service["exposed"] = service.get("exposed", False)
        service["requires_authentication"] = service.get(
            "requires_authentication", True
        )


def _migrate_1_2_0(pipeline: dict) -> None:
    """Fill the missing order property for services"""
    _fill_missing_order(pipeline.get("services"))


# version: (migration function, version to which it's migrated)
_version_to_migration_function = {
    "1.0.0": (_migrate_1_0_0, "1.1.0"),
    "1.1.0": (_migrate_1_1_0, "1.2.0"),
    "1.2.0": (_migrate_1_2_0, "1.2.1"),
}

# Make sure no forward version is repeated.
__to_versions = set([item[1] for item in _version_to_migration_function.items()])
assert len(_version_to_migration_function) == len(__to_versions)
# Make sure no migration function is repeated.
__migration_functions = set(
    [item[0] for item in _version_to_migration_function.items()]
)
assert len(_version_to_migration_function) == len(__migration_functions)


def _ensure_unique_order(sorted_service_list: List[Tuple[str, Dict[str, Any]]]) -> int:
    max_order: int = -1
    for (key, service) in sorted_service_list:
        service_order = service.get("order")
        if service_order is None:
            continue
        if max_order == service_order:
            service["order"] = service_order + 1
        max_order = service["order"]

    return max_order


def _sort_service_key_function(
    service: Dict[str, Any], ordered_dict: Dict[str, int]
) -> int:
    service_name = service.get("name")
    service_order: Optional[int] = service.get("order")
    if service_order is not None:
        ordered_dict[service_name] = service_order
        return service_order
    else:
        return 0


def _fill_missing_order(services: Optional[Dict[str, Dict[str, Any]]]) -> None:
    if services is None:
        return

    service_list = services.items()
    ordered_dict: Dict[str, int] = {}

    service_list = sorted(
        service_list,
        key=lambda service: _sort_service_key_function(service[1], ordered_dict),
    )

    max_order = _ensure_unique_order(service_list)

    to_be_ordered_list: list[str] = []

    for key, service in service_list:
        service_order: Optional[int] = service.get("order")
        if service_order is None:
            to_be_ordered_list.append(key)
        else:
            ordered_dict[key] = service_order

    to_be_ordered_list = sorted(to_be_ordered_list)

    for key in to_be_ordered_list:
        max_order += 1
        services[key]["order"] = max_order


def migrate_pipeline(pipeline: dict) -> None:
    """Migrates a pipeline in place to the latest version."""

    if not pipeline.get("version", ""):
        pipeline["version"] = "1.0.0"

    while pipeline["version"] in _version_to_migration_function:
        migration_func, migrate_to_version = _version_to_migration_function[
            pipeline["version"]
        ]
        migration_func(pipeline)
        pipeline["version"] = migrate_to_version
