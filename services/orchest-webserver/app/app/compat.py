def migrate_pipeline(pipeline):

    # Take care of old pipelines with no defined params.
    if "parameters" not in pipeline:
        pipeline["parameters"] = {}

    for _, step in enumerate(pipeline["steps"]):
        if (
            "kernel" in step
            and "name" in step["kernel"]
            and step["kernel"]["name"] == "ir"
        ):
            step["kernel"]["name"] = "r"

    return pipeline
