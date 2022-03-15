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


# version: (migration function, version to which it's migrated)
_version_to_migration_function = {
    "1.0.0": (_migrate_1_0_0, "1.1.0"),
    "1.1.0": (_migrate_1_1_0, "1.2.0"),
}

# Make sure no forward version is repeated.
__to_versions = [item[1] for item in _version_to_migration_function.items()]
assert len(_version_to_migration_function) == len(__to_versions)
# Make sure no migration function is repeated.
__migration_functions = [item[0] for item in _version_to_migration_function.items()]
assert len(__migration_functions) == len(__to_versions)


def migrate_pipeline(pipeline: dict):
    """Migrates a pipeline in place to the latest version."""

    if not pipeline.get("version", ""):
        pipeline["version"] = "1.0.0"

    while pipeline["version"] in _version_to_migration_function:
        migration_func, migrate_to_version = _version_to_migration_function[
            pipeline["version"]
        ]
        migration_func(pipeline)
        pipeline["version"] = migrate_to_version
