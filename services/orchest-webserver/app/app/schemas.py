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


class DataSourceSchema(ma.Schema):
    class Meta:
        fields = ("name", "source_type", "connection_details")


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


class BackgroundTaskSchema(ma.Schema):
    class Meta:
        fields = ("uuid", "task_type", "status", "code", "result")
