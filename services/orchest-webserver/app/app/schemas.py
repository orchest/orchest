from app.connections import ma


class ProjectSchema(ma.Schema):
    class Meta:
        fields = ("uuid", "path")


class PipelineSchema(ma.Schema):
    class Meta:
        fields = ("uuid", "path")


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
