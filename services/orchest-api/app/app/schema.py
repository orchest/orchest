"""

TODO:
    * Would be amazing if we did not have to maintain a schema here and
      also a seperate but exactly similar database model. Is there a way
      to share attributes?

"""
import datetime

from flask_restx import Model, fields

# Namespace: Sessions
server = Model(
    "Server",
    {
        "port": fields.Integer(
            required=True, default=8888, description="Port to access the server"
        ),
        "base_url": fields.String(required=True, default="/", description="Base URL"),
    },
)

session = Model(
    "Session",
    {
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "pipeline_uuid": fields.String(required=True, description="UUID of pipeline"),
        "status": fields.String(required=True, description="Status of session"),
        "jupyter_server_ip": fields.String(
            required=True, description="IP of the jupyter-server"
        ),
        "notebook_server_info": fields.Nested(
            server, required=True, description="Jupyter notebook server connection info"
        ),
        "user_services": fields.Raw(
            required=False, description="User services part of the session"
        ),
    },
)

sessions = Model(
    "Sessions",
    {
        "sessions": fields.List(
            fields.Nested(session), description="Currently running sessions"
        )
    },
)

project = Model(
    "Project",
    {
        "uuid": fields.String(required=True, description="UUID of project"),
        "env_variables": fields.Raw(
            required=False, description="Environment variables of the project"
        ),
    },
)

project_update = Model(
    "ProjectUpdate",
    {
        "env_variables": fields.Raw(
            required=False, description="Environment variables of the project"
        ),
    },
)

projects = Model(
    "Projects",
    {"projects": fields.List(fields.Nested(project), description="All projects")},
)

service = Model(
    "Service",
    {
        "name": fields.String(required=True, description="Name of the service"),
        "image": fields.String(required=True, description="Image of the service"),
        "scopes": fields.List(
            fields.String, required=True, description="interactive/noninteractive"
        ),
        "command": fields.String(required=False, description="Docker command"),
        "entrypoint": fields.String(required=False, description="Docker entrypoint"),
        "ports": fields.List(
            fields.String, required=False, description="List of service exposed ports"
        ),
        "env_variables": fields.Raw(
            required=False,
            description=("Environment variables of the service."),
        ),
        "env_variables_inherit": fields.List(
            fields.String,
            required=False,
            description=(
                "List of env vars to inherit from project and pipeline env vars "
                " or job env vars. These env vars supersede the service defined ones."
            ),
        ),
        "binds": fields.Raw(
            required=False, description=("Local fs to container mappings")
        ),
        "preserve_base_path": fields.Boolean(
            required=False,
            description=("If the base path should be preserved when proxying."),
        ),
    },
)

# Needs to be defined here, see
# https://flask-restx.readthedocs.io/en/latest/marshalling.html#wildcard-field
service_wildcard = fields.Wildcard(fields.Nested(service))

services = Model("Services", {"*": service_wildcard})

pipeline = Model(
    "Pipeline",
    {
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "uuid": fields.String(required=True, description="UUID of pipeline"),
        "env_variables": fields.Raw(
            required=False, description="Environment variables of the pipeline"
        ),
    },
)

pipeline_update = Model(
    "PipelineUpdate",
    {
        "env_variables": fields.Raw(
            required=False, description="Environment variables of the pipeline"
        ),
    },
)

pipelines = Model(
    "Pipelines",
    {"pipelines": fields.List(fields.Nested(pipeline), description="All pipelines")},
)


session_config = Model(
    "SessionConfig",
    {
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "pipeline_uuid": fields.String(required=True, description="UUID of pipeline"),
        "pipeline_path": fields.String(
            required=True, description="Path to pipeline file"
        ),
        "project_dir": fields.String(
            required=True, description="Path to pipeline files"
        ),
        "host_userdir": fields.String(
            required=True, description="Host path to userdir"
        ),
        "services": services,
    },
)

# Namespace: Runs & Jobs
pipeline_run_config = Model(
    "PipelineRunConfig",
    {
        "project_dir": fields.String(
            required=True, description="Path to project files"
        ),
        "pipeline_path": fields.String(
            required=True, description="Path to pipeline file"
        ),
    },
)

pipeline_run_spec = Model(
    "PipelineRunSpec",
    {
        "uuids": fields.List(
            fields.String(), required=False, description="UUIDs of pipeline steps"
        ),
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "run_type": fields.String(
            required=False,
            default="full",  # TODO: check whether default is used if required=False
            description="Type of run",
            enum=["full", "selection", "incoming"],
        ),
    },
)

pipeline_run_pipeline_step = Model(
    "PipelineRunPipelineStep",
    {
        "run_uuid": fields.String(required=True, description="UUID of the run"),
        "step_uuid": fields.String(
            required=True, description="UUID of the pipeline step"
        ),
        "status": fields.String(
            required=True,
            description="Status of the step",
            enum=["PENDING", "STARTED", "SUCCESS", "FAILURE", "ABORTED"],
        ),
        "started_time": fields.String(
            required=True, description="Time at which the step started executing"
        ),
        "finished_time": fields.String(
            required=True, description="Time at which the step finished executing"
        ),
    },
)

pipeline_run = Model(
    "Run",
    {
        "uuid": fields.String(required=True, description="UUID of run"),
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "pipeline_uuid": fields.String(required=True, description="UUID of pipeline"),
        "status": fields.String(required=True, description="Status of the run"),
        "started_time": fields.String(
            required=True, description="Time at which the pipeline started executing"
        ),
        "finished_time": fields.String(
            required=True, description="Time at which the pipeline finished executing"
        ),
        "pipeline_steps": fields.List(  # TODO: rename
            fields.Nested(pipeline_run_pipeline_step),
            description="Status of each pipeline step",
        ),
        "env_variables": fields.Raw(
            required=True, description="Environment variables of the run"
        ),
    },
)

interactive_run_config = pipeline_run_config.inherit("InteractiveRunConfig", {})

interactive_run_spec = pipeline_run_spec.inherit(
    "InteractiveRunSpec",
    {
        "pipeline_definition": fields.Raw(
            required=True, description="Pipeline definition in JSON"
        ),
        "run_config": fields.Nested(
            interactive_run_config,
            required=True,
            description="Configuration for compute backend",
        ),
    },
)

interactive_run = pipeline_run.inherit(
    "InteractiveRun",
    {
        "server_time": fields.DateTime(
            attribute=lambda x: datetime.datetime.now(datetime.timezone.utc),
            description="Server time to be used when calculating run durations.",
        )
    },
)

interactive_runs = Model(
    "InteractiveRuns",
    {
        "runs": fields.List(
            fields.Nested(interactive_run),
            description='All ran interactive runs during this "lifecycle" of Orchest',
        ),
    },
)

status_update = Model(
    "StatusUpdate",
    {
        "status": fields.String(
            required=True,
            description="New status of executable, e.g. pipeline or step",
            enum=["PENDING", "STARTED", "SUCCESS", "FAILURE", "ABORTED"],
        ),
    },
)

job_update = Model(
    "JobUpdate",
    {
        "cron_schedule": fields.String(
            required=False,
            description="Cron string for recurrent scheduling of the job.",
        ),
        "parameters": fields.List(
            fields.Raw(description="Parameters of the job, one for each run."),
            required=False,
            description="List of run parameters.",
        ),
        "next_scheduled_time": fields.String(
            required=False,
            description=(
                "Time at which the job is scheduled to start. Assumed to be UTC."
            ),
        ),
        "strategy_json": fields.Raw(required=False, description="Strategy json."),
        "confirm_draft": fields.Arbitrary(
            required=False,
            description="If there, the draft is confirmed. Value does not matter.",
        ),
        "env_variables": fields.Raw(
            required=True, description="Environment variables of the job"
        ),
    },
)

# Namespace: Jobs.
non_interactive_run_config = pipeline_run_config.inherit(
    "NonInteractiveRunConfig",
    {
        # Needed for the celery-worker to set the new project-dir for
        # jobs. Note that the `orchest-webserver` has this value
        # stored in the ENV variable `HOST_USER_DIR`.
        "host_user_dir": fields.String(
            required=True, description="Path to the /userdir on the host"
        ),
    },
)

non_interactive_run_spec = pipeline_run_spec.inherit(
    "NonInteractiveRunSpec",
    {
        "run_config": fields.Nested(
            non_interactive_run_config,
            required=True,
            description="Configuration for compute backend",
        ),
        "scheduled_start": fields.String(  # TODO: make DateTime
            required=False,
            # default=datetime.utcnow().isoformat(),
            description="Time at which the run is scheduled to start",
        ),
    },
)

non_interactive_run = pipeline_run.inherit(
    "NonInteractiveRun",
    {
        "job_uuid": fields.String(required=True, description="UUID for job"),
        "job_run_index": fields.Integer(
            required=True, description="To what job run it belongs"
        ),
        "job_run_pipeline_run_index": fields.Integer(
            required=True, description="Index within the job run"
        ),
        "pipeline_run_index": fields.Integer(
            required=True, description="Index across all runs for the same job"
        ),
        "parameters": fields.Raw(required=True, description="Parameters of the run"),
        "server_time": fields.DateTime(
            attribute=lambda x: datetime.datetime.now(datetime.timezone.utc),
            description="Server time to be used when calculating run durations.",
        ),
    },
)

job_spec = Model(
    "Jobspecification",
    {
        "uuid": fields.String(required=True, description="UUID for job"),
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "pipeline_uuid": fields.String(required=True, description="UUID of pipeline"),
        "pipeline_definitions": fields.List(
            fields.Raw(description="Pipeline definition in JSON"),
            required=True,
            description="Collection of pipeline definitions",
        ),
        "pipeline_run_ids": fields.List(
            fields.Integer(
                description=(
                    "Pipeline index corresponding to respective "
                    "list entries in pipeline_definitions."
                )
            ),
            required=True,
            description="Collection of pipeline definition indices.",
        ),
        "pipeline_run_spec": fields.Nested(
            non_interactive_run_spec,
            required=True,
            description=(
                'Specification of the pipeline runs, e.g. "full",' ' "incoming" etc',
            ),
        ),
        "next_scheduled_time": fields.String(
            required=False,
            description=(
                "Time at which the job is scheduled to start. Assumed to be UTC."
            ),
        ),
        "cron_schedule": fields.String(
            required=False,
            description="Cron string for recurrent scheduling of the job.",
        ),
        "parameters": fields.List(
            fields.Raw(description="Parameters of the job, one for each run."),
            required=True,
            description="List of run parameters.",
        ),
        "strategy_json": fields.Raw(required=False, description="Strategy json."),
    },
)

job = Model(
    "Job",
    {
        "uuid": fields.String(required=True, description="UUID for job"),
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "pipeline_uuid": fields.String(required=True, description="UUID of pipeline"),
        "total_scheduled_executions": fields.Integer(
            required=True,
            description="Total number of times the job was run.",
        ),
        "pipeline_definition": fields.Raw(description="Pipeline definition"),
        "pipeline_runs": fields.List(
            fields.Nested(non_interactive_run),
            description="Collection of pipeline runs part of the job",
        ),
        "next_scheduled_time": fields.String(
            required=True,
            description="Next time at which the job is scheduled to start.",
        ),
        "last_scheduled_time": fields.String(
            required=True,
            description="Last time at which the job was scheduled.",
        ),
        "parameters": fields.List(
            fields.Raw(description="Parameters of the job, one for each run."),
            description="List of run parameters.",
        ),
        "schedule": fields.String(
            required=True,
            description="Cron string for recurrent scheduling of the job.",
        ),
        "pipeline_run_spec": fields.Nested(
            non_interactive_run_spec,
            required=True,
            description=(
                'Specification of the pipeline runs, e.g. "full",' ' "incoming" etc',
            ),
        ),
        "status": fields.String(
            required=True,
            description="Status of the job.",
            enum=["DRAFT", "PENDING", "STARTED", "SUCCESS", "ABORTED"],
        ),
        "created_time": fields.String(
            required=True, description="Time at which the job was created"
        ),
        "pipeline_name": fields.String(
            required=True, description="Name of the pipeline."
        ),
        "name": fields.String(required=True, description="Name of the job."),
        "strategy_json": fields.Raw(required=True, description="Strategy json."),
        "env_variables": fields.Raw(
            required=False, description="Environment variables of the job"
        ),
    },
)

jobs = Model(
    "Jobs",
    {
        "jobs": fields.List(fields.Nested(job), description="Collection of all jobs"),
    },
)

environment_build = Model(
    "EnvironmentBuild",
    {
        "uuid": fields.String(
            required=True, description="UUID of the environment build"
        ),
        "project_uuid": fields.String(required=True, description="UUID of the project"),
        "environment_uuid": fields.String(
            required=True, description="UUID of the environment"
        ),
        "project_path": fields.String(required=True, description="Project path"),
        "requested_time": fields.String(
            required=True, description="Time at which the build was requested"
        ),
        "started_time": fields.String(
            required=True, description="Time at which the build started executing"
        ),
        "finished_time": fields.String(
            required=True, description="Time at which the build finished executing"
        ),
        "status": fields.String(
            required=True,
            description="Status of the build",
            enum=["PENDING", "STARTED", "SUCCESS", "FAILURE", "ABORTED"],
        ),
    },
)


environment_build_request = Model(
    "EnvironmentBuildRequest",
    {
        "project_uuid": fields.String(required=True, description="UUID of the project"),
        "environment_uuid": fields.String(
            required=True, description="UUID of the environment"
        ),
        "project_path": fields.String(required=True, description="Project path"),
    },
)

environment_build_requests = Model(
    "EnvironmentBuildRequests",
    {
        "environment_build_requests": fields.List(
            fields.Nested(environment_build_request),
            description="Collection of environment_build_request",
            unique=True,
        ),
    },
)

environment_builds = Model(
    "EnvironmentBuilds",
    {
        "environment_builds": fields.List(
            fields.Nested(environment_build),
            description="Collection of environment_builds",
        ),
    },
)

environment_builds_requests_result = Model(
    "EnvironmentBuildsPost",
    {
        "environment_builds": fields.List(
            fields.Nested(environment_build),
            description="Collection of environment_builds",
        ),
        "failed_requests": fields.List(
            fields.Nested(environment_build_request),
            description="Collection of requests that could not be satisfied",
            unique=True,
        ),
    },
)


jupyter_build = Model(
    "JupyterBuild",
    {
        "uuid": fields.String(required=True, description="UUID of the Jupyter build"),
        "requested_time": fields.String(
            required=True, description="Time at which the build was requested"
        ),
        "started_time": fields.String(
            required=True, description="Time at which the build started executing"
        ),
        "finished_time": fields.String(
            required=True, description="Time at which the build finished executing"
        ),
        "status": fields.String(
            required=True,
            description="Status of the build",
            enum=["PENDING", "STARTED", "SUCCESS", "FAILURE", "ABORTED"],
        ),
    },
)

jupyter_builds = Model(
    "JupyterBuilds",
    {
        "jupyter_builds": fields.List(
            fields.Nested(jupyter_build),
            required=True,
            description="Collection of jupyter_builds",
        ),
    },
)

jupyter_build_request_result = Model(
    "JupyterBuildPost",
    {
        "jupyter_build": fields.Nested(
            jupyter_build,
            description="Requested jupyter_build",
        )
    },
)

validation_environments = Model(
    "GateCheck",
    {
        "project_uuid": fields.String(
            required=True,
            description="The project UUID",
        ),
        "environment_uuids": fields.List(
            fields.String(),
            required=False,
            description="UUIDs to check",
        ),
    },
)

validation_environments_result = Model(
    "GateCheckResult",
    {
        "validation": fields.String(
            required=True,
            description="Whether the gate check passed or failed",
            enum=["pass", "fail"],
        ),
        "fail": fields.List(
            fields.String(),
            required=True,
            description="Environment UUIDs that failed the validation",
        ),
        "actions": fields.List(
            fields.String(enum=["WAIT", "BUILD", "RETRY"]),
            required=True,
            description="Action to convert environment 'fail' to 'pass'",
        ),
        "pass": fields.List(
            fields.String(),
            required=True,
            description="Environment UUIDs that passed the validation",
        ),
    },
)
