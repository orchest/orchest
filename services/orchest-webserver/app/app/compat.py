from _orchest.internals import utils as _utils


def migrate_pipeline(pipeline):

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

        # Can't use a get() with a default value because it would imply
        # a different thing. Migrate from pre-k8s to k8s.
        if "entrypoint" in service:
            if "command" in service:
                service["args"] = service["command"]
                del service["command"]

            service["command"] = service["entrypoint"]
            del service["entrypoint"]
        # Migrate from pre-k8s to k8s.
        if not service.get("ports", []):
            service["ports"] = [8080]
        # Migrate from pre-k8s to k8s.
        service["exposed"] = service.get("exposed", False)
        service["requires_authentication"] = service.get(
            "requires_authentication", True
        )

    for step in pipeline["steps"].values():
        if (
            "kernel" in step
            and "name" in step["kernel"]
            and step["kernel"]["name"] == "ir"
        ):
            step["kernel"]["name"] = "r"

    return pipeline
