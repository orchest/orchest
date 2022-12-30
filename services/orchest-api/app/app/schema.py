"""

TODO:
    * Would be amazing if we did not have to maintain a schema here and
      also a seperate but exactly similar database model. Is there a way
      to share attributes?

"""
import datetime
import sys

from flask_restx import Model, Namespace, fields

from app import errors as self_errors
from app import models, utils

dictionary = Model("Dictionary", {})

update_started_response = Model(
    "UpdateStartedResponse",
    {
        "namespace": fields.String(required=True, description="Namespace"),
        "cluster_name": fields.String(required=True, description="Cluster name"),
    },
)

settings_update_response = Model(
    "SettingsUpdateResponse",
    {
        "requires_restart": fields.List(fields.String, required=True),
        "user_config": fields.Raw(required=True),
    },
)

pagination_data = Model(
    "PaginationData",
    {
        "has_next_page": fields.Boolean(required=True),
        "has_prev_page": fields.Boolean(required=True),
        "next_page_num": fields.Integer(required=True),
        "prev_page_num": fields.Integer(required=True),
        "items_per_page": fields.Integer(required=True),
        "items_in_this_page": fields.Integer(required=True),
        "total_items": fields.Integer(required=True),
        "total_pages": fields.Integer(required=True),
    },
)

_task_statuses = ["PENDING", "STARTED", "SUCCESS", "FAILURE", "ABORTED"]


def _session_base_url(s) -> str:
    if isinstance(s, dict):
        return "/jupyter-server-" + s["project_uuid"][:18] + s["pipeline_uuid"][:18]
    else:
        return "/jupyter-server-" + s.project_uuid[:18] + s.pipeline_uuid[:18]


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
        "name": fields.String(required=False, description="Name of the project"),
        "env_variables": fields.Raw(
            required=False, description="Environment variables of the project"
        ),
    },
)

projects = Model(
    "Projects",
    {"projects": fields.List(fields.Nested(project), description="All projects")},
)

environment = Model(
    "Environment",
    {
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "uuid": fields.String(required=True, description="UUID of environment"),
    },
)

environment_post = Model(
    "EnvironmentPost",
    {
        "uuid": fields.String(required=True, description="UUID of environment"),
    },
)

environments = Model(
    "Environments",
    {
        "environments": fields.List(
            fields.Nested(environment), description="Environments"
        )
    },
)


service = Model(
    "Service",
    {
        "name": fields.String(required=True, description="Name of the service"),
        "image": fields.String(required=True, description="Image of the service"),
        "scopes": fields.List(
            fields.String, required=True, description="interactive/noninteractive"
        ),
        "command": fields.String(required=False, description="Command"),
        "args": fields.String(required=False, description="Args"),
        "ports": fields.List(
            fields.String, required=True, description="List of service exposed ports"
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
        "exposed": fields.Boolean(
            required=True,
            description=("If the service should be reachable outside the cluster."),
        ),
        "binds": fields.Raw(
            required=False, description=("Local fs to container mappings")
        ),
        "preserve_base_path": fields.Boolean(
            required=False,
            description=("If the base path should be preserved when proxying."),
        ),
        "requires_authentication": fields.Boolean(
            required=False,
            description=(
                "Can be set to False to expose the service "
                "without authentication requirements."
            ),
        ),
        "order": fields.Integer(
            required=False,
            description=(
                "Acts as the serial number of a service, "
                "which should be unique within a pipeline."
            ),
        ),
    },
)

# Needs to be defined here, see
# https://flask-restx.readthedocs.io/en/latest/marshalling.html#wildcard-field
service_wildcard = fields.Wildcard(fields.Nested(service))

service_description = Model(
    "ServiceDescription",
    {
        "service": service_wildcard,
        "project_uuid": fields.String(required=True, description="Project UUID"),
        "pipeline_uuid": fields.String(required=True, description="Pipeline UUID."),
        "job_uuid": fields.String(
            required=False,
            description="If the service is NONINTERACTIVE, the job_uuid.",
        ),
        "run_uuid": fields.String(
            required=False,
            description="If the service is NONINTERACTIVE, the run_uuid.",
        ),
        "type": fields.String(
            required=True,
            description="Type of the service. Either INTERACTIVE or NONINTERACTIVE.",
        ),
    },
)

# Needs to be defined here, see
# https://flask-restx.readthedocs.io/en/latest/marshalling.html#wildcard-field
service_description_wildcard = fields.Wildcard(fields.Nested(service_description))
service_descriptions = Model("Services", {"*": service_description_wildcard})

services = Model("Services", {"*": service_wildcard})

session = Model(
    "Session",
    {
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "pipeline_uuid": fields.String(required=True, description="UUID of pipeline"),
        "status": fields.String(required=True, description="Status of session"),
        "base_url": fields.String(
            required=True,
            attribute=lambda s: _session_base_url(s),
            description="Base URL",
        ),
        # The services model doesn't seem to work with restx on output,
        # known issue. See other comments about restx and wildcards.
        "user_services": fields.Raw(),
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

environment_shell_config = Model(
    "EnvironmentShellConfig",
    {
        "pipeline_uuid": fields.String(required=True, description="UUID of pipeline"),
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "pipeline_path": fields.String(
            required=True, description="Path to pipeline file"
        ),
        "userdir_pvc": fields.String(
            required=True, description="Name of the userdir pvc"
        ),
        "project_dir": fields.String(
            required=True, description="Path to project files"
        ),
        "environment_uuid": fields.String(
            required=True, description="UUID of environment"
        ),
    },
)

environment_shell = Model(
    "EnvironmentShell",
    {
        "uuid": fields.String(required=True, description="UUID of environment shell"),
        "session_uuid": fields.String(required=True, description="UUID of session"),
        "hostname": fields.String(
            required=True, description="hostname of environment shell in k8s cluster"
        ),
    },
)

environment_shells = Model(
    "Environment shells",
    {
        "environment_shells": fields.List(
            fields.Nested(environment_shell), description="Environment shells"
        )
    },
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
            required=True, description="Path to project files"
        ),
        "userdir_pvc": fields.String(
            required=True, description="Name of the userdir pvc"
        ),
        "services": fields.Nested(services),
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
            enum=_task_statuses,
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
        "created_time": fields.String(
            required=True, description="Time at which the pipeline run was created"
        ),
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
            enum=_task_statuses,
        ),
        "cluster_node": fields.String(
            required=False,
            description="Node on which the build took place.",
        ),
    },
)

job_parameters_update = Model(
    "JobParametersUpdate",
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
        "max_retained_pipeline_runs": fields.Integer(
            required=False,
            description=(
                "Max number of pipeline runs to retain. The oldest pipeline runs that "
                "are in an end state that are over this number will be deleted."
            ),
        ),
    },
)

draft_job_pipeline_update = Model(
    "DraftJobPipelineUpdate",
    {
        "pipeline_uuid": fields.String(
            required=True,
            description="UUID of the pipeline to use.",
        ),
    },
)

# Namespace: Jobs.
non_interactive_run_config = pipeline_run_config.inherit(
    "NonInteractiveRunConfig",
    {
        # Needed for the celery-worker to set the new project-dir for
        # jobs. Note that the `orchest-webserver` has this value
        # stored in the ENV variable `USERDIR_PVC`.
        "userdir_pvc": fields.String(
            required=True, description="Name of the userdir pvc"
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

job_pipeline_runs = Model(
    "JobPipelineRuns",
    {
        "pipeline_runs": fields.List(
            fields.Nested(non_interactive_run),
            description="Collection of pipeline runs part of a job",
        ),
    },
)

paginated_job_pipeline_runs = Model(
    "PaginatedJobPipelineRuns",
    {
        "pipeline_runs": fields.List(
            fields.Nested(non_interactive_run),
            description="Collection of pipeline runs part of a job",
        ),
        "pagination_data": fields.Nested(pagination_data, required=False),
    },
)

job_spec = Model(
    "Jobspecification",
    {
        "uuid": fields.String(required=True, description="UUID for job"),
        "name": fields.String(required=True, description="Name for job"),
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "pipeline_uuid": fields.String(required=True, description="UUID of pipeline"),
        "pipeline_definition": fields.Raw(
            required=True,
            description="Pipeline definition in JSON",
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
        "max_retained_pipeline_runs": fields.Integer(
            required=False,
            description=(
                "Max number of pipeline runs to retain. The oldest pipeline runs that "
                "are in an end state that are over this number will be deleted."
            ),
        ),
        "snapshot_uuid": fields.String(
            required=True, description="UUID of the snapshot"
        ),
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
        "total_scheduled_pipeline_runs": fields.Integer(
            required=True,
            description="Total number of scheduled pipeline runs.",
        ),
        "pipeline_definition": fields.Raw(description="Pipeline definition"),
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
            enum=["DRAFT", "PAUSED"] + _task_statuses,
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
        "max_retained_pipeline_runs": fields.Integer(
            required=True,
            description=(
                "Max number of pipeline runs to retain. The oldest pipeline runs that "
                "are in an end state that are over this number will be deleted."
            ),
        ),
        "pipeline_run_status_counts": fields.Raw(
            required=False, description="Aggregate of the job pipeline run statuses."
        ),
        "snapshot_uuid": fields.String(required=True, description="UUID of snapshot"),
    },
)

jobs = Model(
    "Jobs",
    {
        "jobs": fields.List(fields.Nested(job), description="Collection of all jobs"),
    },
)

environment_image_build = Model(
    "EnvironmentImageBuild",
    {
        "uuid": fields.String(
            required=True, description="UUID of the environment build"
        ),
        "project_uuid": fields.String(required=True, description="UUID of the project"),
        "environment_uuid": fields.String(
            required=True, description="UUID of the environment"
        ),
        "image_tag": fields.String(
            required=True, description="Tag of the image to be built"
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
            enum=_task_statuses,
        ),
    },
)


environment_image_build_request = Model(
    "EnvironmentImageBuildRequest",
    {
        "project_uuid": fields.String(required=True, description="UUID of the project"),
        "environment_uuid": fields.String(
            required=True, description="UUID of the environment"
        ),
        "project_path": fields.String(required=True, description="Project path"),
    },
)

environment_image_build_requests = Model(
    "EnvironmentImageBuildRequests",
    {
        "environment_image_build_requests": fields.List(
            fields.Nested(environment_image_build_request),
            description="Collection of environment_image_build_request",
            unique=True,
        ),
    },
)

environment_image_builds = Model(
    "EnvironmentImageBuilds",
    {
        "environment_image_builds": fields.List(
            fields.Nested(environment_image_build),
            description="Collection of environment_image_builds",
        ),
    },
)

environment_image_builds_requests_result = Model(
    "EnvironmentImageBuildsPost",
    {
        "environment_image_builds": fields.List(
            fields.Nested(environment_image_build),
            description="Collection of environment_image_builds",
        ),
        "failed_requests": fields.List(
            fields.Nested(environment_image_build_request),
            description="Collection of requests that could not be satisfied",
            unique=True,
        ),
    },
)

environment_image = Model(
    "EnvironmentImage",
    {
        "project_uuid": fields.String(required=True, description="UUID of project"),
        "environment_uuid": fields.String(
            required=True, description="UUID of environment"
        ),
        "tag": fields.String(required=True, description="Tag of the image"),
    },
)

environment_images = Model(
    "EnvironmentImages",
    {"environment_images": fields.List(fields.Nested(environment_image))},
)

environment_images_to_pre_pull = Model(
    "EnvironmentImagesToPrepull",
    {"pre_pull_images": fields.List(fields.String(required=True))},
)

active_environment_images = Model(
    "ActiveEnvironmentImages",
    {"active_environment_images": fields.List(fields.String(required=True))},
)


jupyter_image_build = Model(
    "JupyterEnvironmentBuild",
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
            required=True, description="Status of the build", enum=_task_statuses
        ),
    },
)

jupyter_image_builds = Model(
    "JupyterEnvironmentBuilds",
    {
        "jupyter_image_builds": fields.List(
            fields.Nested(jupyter_image_build),
            required=True,
            description="Collection of jupyter_image_builds",
        ),
    },
)

jupyter_image_build_request_result = Model(
    "JupyterEnvironmentBuildPost",
    {
        "jupyter_image_build": fields.Nested(
            jupyter_image_build,
            description="Requested jupyter_image_build",
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

next_scheduled_job_data = Model(
    "NextScheduledJobData",
    {
        "uuid": fields.String(required=False, description="UUID of the job."),
        "next_scheduled_time": fields.String(
            required=False,
            description=("Time at which the job is scheduled to start. UTC."),
        ),
    },
)

_idleness_check_result_details = Model(
    "IdlenessCheckResultDetails",
    {
        "active_clients": fields.Boolean(
            required=True,
        ),
        "ongoing_environment_image_builds": fields.Boolean(
            required=True,
        ),
        "ongoing_jupyterlab_builds": fields.Boolean(
            required=True,
        ),
        "ongoing_interactive_runs": fields.Boolean(
            required=True,
        ),
        "ongoing_job_runs": fields.Boolean(
            required=True,
        ),
        "busy_kernels": fields.Boolean(
            required=True,
        ),
    },
)

idleness_check_result = Model(
    "IdlenessCheckResult",
    {
        "idle": fields.Boolean(
            required=True,
            description="True if the Orchest-api is idle.",
        ),
        "details": fields.Nested(
            _idleness_check_result_details,
            required=True,
            description="Details of the idleness check.",
        ),
    },
)

subscription_spec = Model(
    "SubscriptionSpec",
    {
        "event_type": fields.String(
            required=True, description="Event type to subscribe to."
        ),
        "project_uuid": fields.String(
            required=False,
            description="Specifies if the subscription is only for a specific project.",
        ),
        "job_uuid": fields.String(
            required=False,
            description=(
                "Specifies if the subscription is only for a "
                "specific job of a project.",
            ),
        ),
    },
)

subscriber_spec = Model(
    "SubscriberSpec",
    {
        "subscriptions": fields.List(
            fields.Nested(subscription_spec),
            description="Collection of subscriptions, elements should be unique.",
            min_items=0,
        ),
    },
)

webhook_spec = subscriber_spec.inherit(
    "WebhookSpec",
    {
        "url": fields.String(required=True, description="URL of the webhook."),
        "name": fields.String(required=True, description="Name of the webhook."),
        "verify_ssl": fields.Boolean(
            required=True, description="If https certificate should be verified."
        ),
        "secret": fields.String(
            required=False, description="Secret used for HMAC signing the payload."
        ),
        "content_type": fields.String(
            required=True,
            description="Content type of the payload, e.g. json, urlencoded, etc.",
            enum=[
                models.Webhook.ContentType.JSON.value,
                models.Webhook.ContentType.URLENCODED.value,
            ],
        ),
    },
)

webhook_mutation = Model(
    "WebhookMutation",
    {
        "url": fields.String(required=False, description="URL of the webhook."),
        "name": fields.String(required=False, description="Name of the webhook."),
        "verify_ssl": fields.Boolean(
            required=False, description="If https certificate should be verified."
        ),
        "secret": fields.String(
            required=False, description="Secret used for HMAC signing the payload."
        ),
        "content_type": fields.String(
            required=False,
            description="Content type of the payload, e.g. json, urlencoded, etc.",
            enum=[
                models.Webhook.ContentType.JSON.value,
                models.Webhook.ContentType.URLENCODED.value,
            ],
        ),
        "subscriptions": fields.List(
            fields.Nested(subscription_spec),
            required=False,
            description="Collection of subscriptions, elements should be unique.",
            min_items=0,
        ),
    },
    strict=True,
)

subscription = Model(
    "Subscription",
    {
        "uuid": fields.String(required=True, description="UUID of the subscription."),
        "subscriber_uuid": fields.String(
            required=True, description="UUID of the subscriber."
        ),
        "event_type": fields.String(
            required=True, description="Event type subscribed to."
        ),
        "project_uuid": fields.String(required=False, description="Project uuid."),
        "job_uuid": fields.String(required=False, description="Job uuid."),
    },
)


subscriber = Model(
    "Subscriber",
    {
        "uuid": fields.String(required=True, description="UUID of the subscriber."),
        "type": fields.String(
            required=True,
            description="Type of subscriber",
            enum=["webhook", "subscriber"],
        ),
        "subscriptions": fields.List(
            fields.Nested(subscription),
            description="Subscriptions of the subscriber.",
            required=False,
        ),
    },
)

webhook = subscriber.inherit(
    "Webhook",
    {
        "url": fields.String(
            required=True,
            attribute=lambda webhook: utils.extract_domain_name(webhook.url),
            description="URL of the webhook.",
        ),
        "name": fields.String(required=True, description="Name of the webhook."),
        "verify_ssl": fields.Boolean(
            required=True, description="If https certificate should be verified."
        ),
        "content_type": fields.String(
            required=True,
            description="Content type of the payload, e.g. json, urlencoded, etc.",
            enum=[
                models.Webhook.ContentType.JSON.value,
                models.Webhook.ContentType.URLENCODED.value,
            ],
        ),
    },
)

webhook_with_secret = webhook.inherit(
    "WebhookWithSecret",
    {
        "secret": fields.String(
            required=True, description="Secret used for HMAC signing the payload."
        ),
    },
)

subscribers = Model(
    "Subscribers",
    {
        "subscribers": fields.List(
            fields.Nested(subscriber), description="List of subscribers."
        ),
    },
)

event = Model(
    "Event",
    {
        "uuid": fields.String(required=True, description="UUID of the event."),
        "type": fields.String(required=True, description="Type of event."),
        "timestamp": fields.DateTime(
            required=True, description="When the event happened."
        ),
    },
)

kernel_spec = Model(
    "KernelRequest",
    {
        "kernel_working_dir": fields.String(required=False),
        "kernel_username": fields.String(required=False),
        "kernel_id": fields.String(required=True),
        "kernel_image": fields.String(required=True),
        "eg_response_address": fields.String(required=True),
        "spark_context_init_mode": fields.String(required=False),
        # TODO: store this data at the interactive session db record
        # level instead of passing it from jupyter EG.
        "pipeline_file": fields.String(required=True),
        "pipeline_path": fields.String(required=True),
        "project_dir": fields.String(required=True),
    },
)


snapshot_spec = Model(
    "SnapshotSpec",
    {
        "project_uuid": fields.String(required=True, description="UUID of the project"),
        "pipelines": fields.Raw(
            required=False,
            description=(
                "Path and definition of each pipeline contained in the snapshot."
            ),
        ),
    },
)

snapshot = snapshot_spec.inherit(
    "Snapshot",
    {
        "uuid": fields.String(required=True, description="UUID of the snapshot"),
        "timestamp": fields.DateTime(
            required=True, description="Creation time of the snapshot record."
        ),
    },
)

snapshots = Model(
    "Snapshots",
    {
        "snapshots": fields.List(
            fields.Nested(snapshot), description="Collection of all snapshots"
        ),
    },
)

_git_import_errors = [
    _type.__name__ for _type in utils.get_descendant_types(self_errors.GitImportError)
]

git_import = Model(
    "GitImport",
    {
        "uuid": fields.String(required=True),
        "url": fields.String(required=True),
        "requested_name": fields.String(required=False),
        "status": fields.String(required=True, enum=_task_statuses),
        "project_uuid": fields.String(required=False),
        "result": fields.Raw(
            description=(
                'In some FAILURE cases "error" will be mapped to an error code, '
                f"possible codes: {_git_import_errors}."
            )
        ),
    },
)

git_import_request = Model(
    "GitImportRequest",
    {
        "url": fields.String(required=True),
        "project_name": fields.String(required=False),
        "auth_user_uuid": fields.String(required=False),
    },
)

auth_user_request = Model(
    "AuthUserRequest",
    {
        "uuid": fields.String(required=True),
    },
)

git_config = Model(
    "GitConfig",
    {
        "uuid": fields.String(required=True),
        "name": fields.String(required=True),
        "email": fields.String(required=True),
    },
)

git_configs = Model(
    "GitConfigs",
    {"git_configs": fields.List(fields.Nested(git_config))},
)

git_config_request = Model(
    "GitConfigRequest",
    {
        "name": fields.String(required=True),
        "email": fields.String(required=True),
    },
)

ssh_key = Model(
    "SSHKey",
    {
        "uuid": fields.String(required=True),
        "name": fields.String(required=True),
        "created_time": fields.String(required=True),
    },
)

ssh_keys = Model(
    "SSHKeys",
    {"ssh_keys": fields.List(fields.Nested(ssh_key))},
)

ssh_key_request = Model(
    "SSHKeyRequest",
    {
        "name": fields.String(required=True),
        "key": fields.String(required=True),
    },
)


def register_schema(api: Namespace) -> Namespace:
    current_module = sys.modules[__name__]
    all_models = [
        getattr(current_module, attr)
        for attr in dir(current_module)
        if isinstance(getattr(current_module, attr), Model)
    ]

    # TODO: only a subset of all models should be registered.
    for model in all_models:
        api.add_model(model.name, model)

    return api
