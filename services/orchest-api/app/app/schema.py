"""

TODO:
    * Would be amazing if we did not have to maintain a schema here and
      also a seperate but exactly similar database model. Is there a way
      to share attributes?

"""
from flask_restplus import Model, fields

from _orchest.internals import config as _config

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

pipeline = Model(
    "Pipeline",
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
        "settings": fields.Raw(
            required=True, description="Settings from the pipeline definition"
        ),
    },
)

# Namespace: Runs & Experiments
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
            enum=["PENDING", "STARTED", "SUCCESS", "FAILURE", "ABORTED", "REVOKED"],
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
        "run_uuid": fields.String(required=True, description="UUID of run"),
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "pipeline_uuid": fields.String(required=True, description="UUID of pipeline"),
        "status": fields.String(required=True, description="Status of the run"),
        "pipeline_steps": fields.List(  # TODO: rename
            fields.Nested(pipeline_run_pipeline_step),
            description="Status of each pipeline step",
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

interactive_run = pipeline_run.inherit("InteractiveRun", {})

interactive_runs = Model(
    "InteractiveRuns",
    {
        "runs": fields.List(
            fields.Nested(interactive_run),
            description='All ran interactive runs during this "lifecycle" of Orchest',
        )
    },
)

status_update = Model(
    "StatusUpdate",
    {
        "status": fields.String(
            required=True,
            description="New status of executable, e.g. pipeline or step",
            enum=["PENDING", "STARTED", "SUCCESS", "FAILURE", "ABORTED", "REVOKED"],
        ),
    },
)

# Namespace: Experiments.
non_interactive_run_config = pipeline_run_config.inherit(
    "NonInteractiveRunConfig",
    {
        # Needed for the celery-worker to set the new project-dir for
        # experiments. Note that the `orchest-webserver` has this value
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
        "experiment_uuid": fields.String(
            required=True, description="UUID for experiment"
        ),
        "pipeline_run_id": fields.Integer(
            required=True, description="Respective run ID in experiment"
        ),
    },
)

experiment_spec = Model(
    "ExperimentSpecification",
    {
        "experiment_uuid": fields.String(
            required=True, description="UUID for experiment"
        ),
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
            description='Specification of the pipeline runs, e.g. "full", "incoming" etc',
        ),
        "scheduled_start": fields.String(
            required=True,
            description="Time at which the experiment is scheduled to start",
        ),
    },
)

experiment = Model(
    "Experiment",
    {
        "experiment_uuid": fields.String(
            required=True, description="UUID for experiment"
        ),
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "pipeline_uuid": fields.String(required=True, description="UUID of pipeline"),
        "total_number_of_pipeline_runs": fields.Integer(
            required=True,
            description="Total number of pipeline runs part of the experiment",
        ),
        "pipeline_runs": fields.List(
            fields.Nested(non_interactive_run),
            description="Collection of pipeline runs part of the experiment",
        ),
        "scheduled_start": fields.String(
            required=True,
            description="Time at which the experiment is scheduled to start",
        ),
        "completed_pipeline_runs": fields.Integer(
            required=True,
            default=0,
            description="Number of completed pipeline runs part of the experiment",
        ),
    },
)

experiments = Model(
    "Experiments",
    {
        "experiments": fields.List(
            fields.Nested(experiment), description="Collection of all experiments"
        ),
    },
)

environment_build = Model(
    "EnvironmentBuild",
    {
        "build_uuid": fields.String(
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

environment_builds = Model(
    "EnvironmentBuilds",
    {
        "environment_builds": fields.List(
            fields.Nested(environment_build),
            description="Collection of environment_builds",
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
