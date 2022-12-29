from app.connections import ma


class ProjectSchema(ma.Schema):
    # Note that env_variables is not part of the model, it's obtained by
    # querying the orchest-api.
    class Meta:
        fields = ("uuid", "path", "env_variables")


class PipelineSchema(ma.Schema):
    # Note that env_variables is not part of the model, it's obtained by
    # querying the orchest-api.
    class Meta:
        fields = ("uuid", "path", "env_variables")


class EnvironmentSchema(ma.Schema):
    class Meta:
        fields = (
            "uuid",
            "name",
            "project_uuid",
            "language",
            "base_image",
            "gpu_support",
            "setup_script",
        )
