"""Module to register events to keep track of.

Upon the registration of an event in the db, deliveries are created
accordingly based on any subscribers subscribed to the event type that
happened.
"""
from app import models
from app import types as app_types
from app import utils as app_utils
from app.connections import db
from app.core import notifications

_logger = app_utils.get_logger()


def _register_event(ev: models.Event) -> None:
    # So that any FK created in the same transaction and referenced by
    # the event is visible to the event.
    db.session.flush()

    db.session.add(ev)

    project_uuid = None
    job_uuid = None
    if isinstance(ev, models.ProjectEvent):
        project_uuid = ev.project_uuid
    # Don't use a else if, JobEvent ISA ProjectEvent.
    if isinstance(ev, models.JobEvent):
        job_uuid = ev.job_uuid

    # So that the event.uuid is generated and visible as a FK.
    db.session.flush()
    _logger.info(ev)

    subscribers = notifications.get_subscribers_subscribed_to_event(
        ev.type, project_uuid=project_uuid, job_uuid=job_uuid
    )
    for sub in subscribers:
        if isinstance(sub, models.AnalyticsSubscriber):
            if app_utils.OrchestSettings()["TELEMETRY_DISABLED"]:
                _logger.info(
                    "Telemetry is disabled, skipping event delivery to analytics."
                )
                continue
            payload = ev.to_telemetry_payload()
        else:
            payload = ev.to_notification_payload()

        _logger.info(
            f"Scheduling delivery for event {ev.uuid}, event type: {ev.type} for "
            f"deliveree {sub.uuid} of type {sub.type}."
        )

        delivery = models.Delivery(
            event=ev.uuid,
            deliveree=sub.uuid,
            status="SCHEDULED",
            notification_payload=payload,
        )
        db.session.add(delivery)


def _register_one_off_job_event(type: str, project_uuid: str, job_uuid: str) -> None:
    ev = models.OneOffJobEvent(type=type, project_uuid=project_uuid, job_uuid=job_uuid)
    _register_event(ev)


def _register_cron_job_event(type: str, project_uuid: str, job_uuid: str) -> None:
    ev = models.CronJobEvent(type=type, project_uuid=project_uuid, job_uuid=job_uuid)
    _register_event(ev)


def _is_cron_job(job_uuid: str) -> bool:
    return (
        db.session.query(models.Job.schedule).filter(models.Job.uuid == job_uuid).one()
    ).schedule is not None


def register_job_created(project_uuid: str, job_uuid: str) -> None:
    """Adds a job creation event to the db, does not commit."""
    if _is_cron_job(job_uuid):
        _register_cron_job_event("project:cron-job:created", project_uuid, job_uuid)
    else:
        _register_one_off_job_event(
            "project:one-off-job:created", project_uuid, job_uuid
        )


def register_job_started(project_uuid: str, job_uuid: str) -> None:
    """Adds a job started event to the db, does not commit."""
    if _is_cron_job(job_uuid):
        _register_cron_job_event("project:cron-job:started", project_uuid, job_uuid)
    else:
        _register_one_off_job_event(
            "project:one-off-job:started", project_uuid, job_uuid
        )


def register_job_deleted(project_uuid: str, job_uuid: str) -> None:
    """Adds a job deletion event to the db, does not commit.

    Currently not of much use given the deletion on cascade of proj and
    job FKs, might be altered later.
    """
    if _is_cron_job(job_uuid):
        _register_cron_job_event("project:cron-job:deleted", project_uuid, job_uuid)
    else:
        _register_one_off_job_event(
            "project:one-off-job:deleted", project_uuid, job_uuid
        )


def register_job_cancelled(project_uuid: str, job_uuid: str) -> None:
    """Adds a job cancellation event to the db, does not commit."""
    if _is_cron_job(job_uuid):
        _register_cron_job_event("project:cron-job:cancelled", project_uuid, job_uuid)
    else:
        _register_one_off_job_event(
            "project:one-off-job:cancelled", project_uuid, job_uuid
        )


def register_job_failed(project_uuid: str, job_uuid: str) -> None:
    """Adds a job failed event to the db, does not commit."""
    if _is_cron_job(job_uuid):
        _register_cron_job_event("project:cron-job:failed", project_uuid, job_uuid)
    else:
        _register_one_off_job_event(
            "project:one-off-job:failed", project_uuid, job_uuid
        )


def register_job_updated(
    was_cron_job: bool, project_uuid: str, job_uuid: str, update: app_types.EntityUpdate
) -> None:
    """Adds a job update event to the db, does not commit.

    Args:
        was_cron_job: Necessary because an update might make a non
            cron-job into a cron-job, and we are interested in the
            status of the job pre-change. I.e. adding a schedule and
            thus making a one off job into a cronjob should lead to a
            OneOffJobUpdateEvent, not a CronJobUpdateEvent.
        project_uuid:
        job_uuid:
        update:
    """
    if was_cron_job:
        ev = models.CronJobUpdateEvent(
            type="project:cron-job:updated",
            project_uuid=project_uuid,
            job_uuid=job_uuid,
            update=update,
        )
        _register_event(ev)
    else:
        ev = models.OneOffJobUpdateEvent(
            type="project:one-off-job:updated",
            project_uuid=project_uuid,
            job_uuid=job_uuid,
            update=update,
        )
        _register_event(ev)


def register_job_succeeded(project_uuid: str, job_uuid: str) -> None:
    """Adds a job succeeded event to the db, does not commit."""
    _register_one_off_job_event("project:one-off-job:succeeded", project_uuid, job_uuid)


def register_cron_job_paused(project_uuid: str, job_uuid: str) -> None:
    """Adds a cron-job paused event to the db, does not commit."""
    _register_cron_job_event("project:cron-job:paused", project_uuid, job_uuid)


def register_cron_job_unpaused(project_uuid: str, job_uuid: str) -> None:
    """Adds a cron-job unpaused event to the db, doesn't commit."""
    _register_cron_job_event("project:cron-job:unpaused", project_uuid, job_uuid)


def register_cron_job_run_started(
    project_uuid: str, job_uuid: str, run_index: int
) -> None:
    """Adds a cron-job run started to the db, doesn't commit."""
    # Need to get the value now because a cronjob can be edited.
    job = (
        db.session.query(models.Job.parameters).filter(
            models.Job.project_uuid == project_uuid,
            models.Job.uuid == job_uuid,
        )
    ).one()

    ev = models.CronJobRunEvent(
        type="project:cron-job:run:started",
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        run_index=run_index,
        total_pipeline_runs=len(job.parameters),
    )
    _register_event(ev)


def register_cron_job_run_succeeded(
    project_uuid: str, job_uuid: str, run_index: int
) -> None:
    """Adds a cron-job run succeeded to the db, doesn't commit."""
    # Retrieve the original value, the cronjob could have been edited.
    run_started_event = (
        db.session.query(models.CronJobRunEvent.total_pipeline_runs).filter(
            models.CronJobRunEvent.type == "project:cron-job:run:started",
            models.CronJobRunEvent.project_uuid == project_uuid,
            models.CronJobRunEvent.job_uuid == job_uuid,
            models.CronJobRunEvent.run_index == run_index,
        )
    ).first()
    total_pipeline_runs = (
        run_started_event.total_pipeline_runs if run_started_event is not None else None
    )
    ev = models.CronJobRunEvent(
        type="project:cron-job:run:succeeded",
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        run_index=run_index,
        total_pipeline_runs=total_pipeline_runs,
    )
    _register_event(ev)


def register_cron_job_run_failed(
    project_uuid: str, job_uuid: str, run_index: int
) -> None:
    """Adds a cron-job run failed to the db, doesn't commit."""
    # Retrieve the original value, the cronjob could have been edited.
    run_started_event = (
        db.session.query(models.CronJobRunEvent.total_pipeline_runs).filter(
            models.CronJobRunEvent.type == "project:cron-job:run:started",
            models.CronJobRunEvent.project_uuid == project_uuid,
            models.CronJobRunEvent.job_uuid == job_uuid,
            models.CronJobRunEvent.run_index == run_index,
        )
    ).first()
    total_pipeline_runs = (
        run_started_event.total_pipeline_runs if run_started_event is not None else None
    )
    ev = models.CronJobRunEvent(
        type="project:cron-job:run:failed",
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        run_index=run_index,
        total_pipeline_runs=total_pipeline_runs,
    )
    _register_event(ev)


def _register_one_off_job_pipeline_run_event(
    type: str, project_uuid: str, job_uuid: str, pipeline_run_uuid: str
):
    ev = models.OneOffJobPipelineRunEvent(
        type=type,
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        pipeline_run_uuid=pipeline_run_uuid,
    )
    _register_event(ev)


def _register_cron_job_run_pipeline_run_event(
    type: str, project_uuid: str, job_uuid: str, pipeline_run_uuid: str
):
    run_index = (
        db.session.query(models.NonInteractivePipelineRun.job_run_index)
        .filter(
            models.NonInteractivePipelineRun.job_uuid == job_uuid,
            models.NonInteractivePipelineRun.uuid == pipeline_run_uuid,
        )
        .one()
    ).job_run_index
    run_started_event = (
        db.session.query(models.CronJobRunEvent.total_pipeline_runs).filter(
            models.CronJobRunEvent.type == "project:cron-job:run:started",
            models.CronJobRunEvent.project_uuid == project_uuid,
            models.CronJobRunEvent.job_uuid == job_uuid,
            models.CronJobRunEvent.run_index == run_index,
        )
    ).first()
    total_pipeline_runs = (
        run_started_event.total_pipeline_runs if run_started_event is not None else None
    )
    ev = models.CronJobRunPipelineRunEvent(
        type=type,
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        pipeline_run_uuid=pipeline_run_uuid,
        run_index=run_index,
        total_pipeline_runs=total_pipeline_runs,
    )
    _register_event(ev)


def register_job_pipeline_run_created(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run created event to the db, doesn't commit."""
    if _is_cron_job(job_uuid):
        _register_cron_job_run_pipeline_run_event(
            "project:cron-job:run:pipeline-run:created",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    else:
        _register_one_off_job_pipeline_run_event(
            "project:one-off-job:pipeline-run:created",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )


def register_job_pipeline_run_started(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run started event to the db, doesn't commit."""
    if _is_cron_job(job_uuid):
        _register_cron_job_run_pipeline_run_event(
            "project:cron-job:run:pipeline-run:started",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    else:
        _register_one_off_job_pipeline_run_event(
            "project:one-off-job:pipeline-run:started",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )


def register_job_pipeline_run_cancelled(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run cancelled event to the db, doesn't commit."""
    if _is_cron_job(job_uuid):
        _register_cron_job_run_pipeline_run_event(
            "project:cron-job:run:pipeline-run:cancelled",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    else:
        _register_one_off_job_pipeline_run_event(
            "project:one-off-job:pipeline-run:cancelled",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )


def register_job_pipeline_run_failed(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run failed event to the db, doesn't commit."""
    if _is_cron_job(job_uuid):
        _register_cron_job_run_pipeline_run_event(
            "project:cron-job:run:pipeline-run:failed",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    else:
        _register_one_off_job_pipeline_run_event(
            "project:one-off-job:pipeline-run:failed",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )


def register_job_pipeline_run_deleted(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run deleted event to the db, doesn't commit."""
    if _is_cron_job(job_uuid):
        _register_cron_job_run_pipeline_run_event(
            "project:cron-job:run:pipeline-run:deleted",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    else:
        _register_one_off_job_pipeline_run_event(
            "project:one-off-job:pipeline-run:deleted",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )


def register_job_pipeline_run_succeeded(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run succeeded event to the db, doesn't commit."""
    if _is_cron_job(job_uuid):
        _register_cron_job_run_pipeline_run_event(
            "project:cron-job:run:pipeline-run:succeeded",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    else:
        _register_one_off_job_pipeline_run_event(
            "project:one-off-job:pipeline-run:succeeded",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )


def _register_jupyter_image_build_event(type: str, build_uuid: str) -> None:
    ev = models.JupyterImageBuildEvent(type=type, build_uuid=build_uuid)
    _register_event(ev)


def register_jupyter_image_build_created(build_uuid: str) -> None:
    _register_jupyter_image_build_event("jupyter:image-build:created", build_uuid)


def register_jupyter_image_build_started(build_uuid: str) -> None:
    _register_jupyter_image_build_event("jupyter:image-build:started", build_uuid)


def register_jupyter_image_build_cancelled(build_uuid: str) -> None:
    _register_jupyter_image_build_event("jupyter:image-build:cancelled", build_uuid)


def register_jupyter_image_build_failed(build_uuid: str) -> None:
    _register_jupyter_image_build_event("jupyter:image-build:failed", build_uuid)


def register_jupyter_image_build_succeeded(build_uuid: str) -> None:
    _register_jupyter_image_build_event("jupyter:image-build:succeeded", build_uuid)


def _register_interactive_session_event(
    type: str, project_uuid: str, pipeline_uuid: str
) -> None:
    ev = models.InteractiveSessionEvent(
        type=type,
        project_uuid=project_uuid,
        pipeline_uuid=pipeline_uuid,
    )
    _register_event(ev)


def _register_interactive_session_started(
    project_uuid: str, pipeline_uuid: str
) -> None:
    _register_interactive_session_event(
        "project:pipeline:interactive-session:started", project_uuid, pipeline_uuid
    )


def _register_interactive_session_stopped(
    project_uuid: str, pipeline_uuid: str
) -> None:
    _register_interactive_session_event(
        "project:pipeline:interactive-session:stopped", project_uuid, pipeline_uuid
    )


def _register_interactive_session_failed(project_uuid: str, pipeline_uuid: str) -> None:
    _register_interactive_session_event(
        "project:pipeline:interactive-session:failed", project_uuid, pipeline_uuid
    )


def _register_interactive_session_service_restarted(
    project_uuid: str, pipeline_uuid: str
) -> None:
    _register_interactive_session_event(
        "project:pipeline:interactive-session:service-restarted",
        project_uuid,
        pipeline_uuid,
    )


def _register_interactive_session_service_succeeded(
    project_uuid: str, pipeline_uuid: str
) -> None:
    _register_interactive_session_event(
        "project:pipeline:interactive-session:succeeded", project_uuid, pipeline_uuid
    )


def _register_interactive_pipeline_run_event(
    type: str, project_uuid: str, pipeline_uuid: str, pipeline_run_uuid: str
) -> None:
    ev = models.InteractivePipelineRunEvent(
        type=type,
        project_uuid=project_uuid,
        pipeline_uuid=pipeline_uuid,
        pipeline_run_uuid=pipeline_run_uuid,
    )
    _register_event(ev)


def register_interactive_pipeline_run_created(
    project_uuid: str, pipeline_uuid: str, pipeline_run_uuid: str
) -> None:
    _register_interactive_pipeline_run_event(
        "project:pipeline:interactive-session:pipeline-run:created",
        project_uuid=project_uuid,
        pipeline_uuid=pipeline_uuid,
        pipeline_run_uuid=pipeline_run_uuid,
    )


def register_interactive_pipeline_run_started(
    project_uuid: str, pipeline_uuid: str, pipeline_run_uuid: str
) -> None:
    _register_interactive_pipeline_run_event(
        "project:pipeline:interactive-session:pipeline-run:started",
        project_uuid=project_uuid,
        pipeline_uuid=pipeline_uuid,
        pipeline_run_uuid=pipeline_run_uuid,
    )


def register_interactive_pipeline_run_cancelled(
    project_uuid: str, pipeline_uuid: str, pipeline_run_uuid: str
) -> None:
    _register_interactive_pipeline_run_event(
        "project:pipeline:interactive-session:pipeline-run:cancelled",
        project_uuid=project_uuid,
        pipeline_uuid=pipeline_uuid,
        pipeline_run_uuid=pipeline_run_uuid,
    )


def register_interactive_pipeline_run_failed(
    project_uuid: str, pipeline_uuid: str, pipeline_run_uuid: str
) -> None:
    _register_interactive_pipeline_run_event(
        "project:pipeline:interactive-session:pipeline-run:failed",
        project_uuid=project_uuid,
        pipeline_uuid=pipeline_uuid,
        pipeline_run_uuid=pipeline_run_uuid,
    )


def register_interactive_pipeline_run_succeeded(
    project_uuid: str, pipeline_uuid: str, pipeline_run_uuid: str
) -> None:
    _register_interactive_pipeline_run_event(
        "project:pipeline:interactive-session:pipeline-run:succeeded",
        project_uuid=project_uuid,
        pipeline_uuid=pipeline_uuid,
        pipeline_run_uuid=pipeline_run_uuid,
    )


def _register_project_event(type: str, project_uuid: str) -> None:
    ev = models.ProjectEvent(
        type=type,
        project_uuid=project_uuid,
    )
    _register_event(ev)


def register_project_created_event(project_uuid: str):
    _register_project_event("project:created", project_uuid)


def register_project_deleted_event(project_uuid: str):
    _register_project_event("project:deleted", project_uuid)


def _register_environment_event(
    type: str, project_uuid: str, environment_uuid: str
) -> None:
    ev = models.EnvironmentEvent(
        type=type, project_uuid=project_uuid, environment_uuid=environment_uuid
    )
    _register_event(ev)


def register_environment_created_event(project_uuid: str, environment_uuid: str):
    _register_environment_event(
        "project:environment:created", project_uuid, environment_uuid
    )


def register_environment_deleted_event(project_uuid: str, environment_uuid: str):
    _register_environment_event(
        "project:environment:deleted", project_uuid, environment_uuid
    )


def register_project_updated_event(project_uuid: str, update: app_types.EntityUpdate):
    ev = models.ProjectUpdateEvent(
        type="project:updated", project_uuid=project_uuid, update=update
    )
    _register_event(ev)


def _register_environment_image_build_event(
    type: str, project_uuid: str, environment_uuid: str, image_tag: str
) -> None:
    ev = models.EnvironmentImageBuildEvent(
        type=type,
        project_uuid=project_uuid,
        environment_uuid=environment_uuid,
        image_tag=image_tag,
    )
    _register_event(ev)


def register_environment_image_build_created_event(
    project_uuid: str, environment_uuid: str, image_tag: str
):
    _register_environment_image_build_event(
        "project:environment:image-build:created",
        project_uuid,
        environment_uuid,
        image_tag,
    )


def register_environment_image_build_started_event(
    project_uuid: str, environment_uuid: str, image_tag: str
):
    _register_environment_image_build_event(
        "project:environment:image-build:started",
        project_uuid,
        environment_uuid,
        image_tag,
    )


def register_environment_image_build_cancelled_event(
    project_uuid: str, environment_uuid: str, image_tag: str
):
    _register_environment_image_build_event(
        "project:environment:image-build:cancelled",
        project_uuid,
        environment_uuid,
        image_tag,
    )


def register_environment_image_build_failed_event(
    project_uuid: str, environment_uuid: str, image_tag: str
):
    _register_environment_image_build_event(
        "project:environment:image-build:failed",
        project_uuid,
        environment_uuid,
        image_tag,
    )


def register_environment_image_build_succeeded_event(
    project_uuid: str, environment_uuid: str, image_tag: str
):
    _register_environment_image_build_event(
        "project:environment:image-build:succeeded",
        project_uuid,
        environment_uuid,
        image_tag,
    )


def _register_pipeline_event(type: str, project_uuid: str, pipeline_uuid: str) -> None:
    ev = models.PipelineEvent(
        type=type,
        project_uuid=project_uuid,
        pipeline_uuid=pipeline_uuid,
    )
    _register_event(ev)


def register_pipeline_created_event(project_uuid: str, pipeline_uuid: str):
    _register_pipeline_event("project:pipeline:created", project_uuid, pipeline_uuid)


def register_pipeline_deleted_event(project_uuid: str, pipeline_uuid: str):
    _register_pipeline_event("project:pipeline:deleted", project_uuid, pipeline_uuid)


def register_pipeline_updated_event(
    project_uuid: str, pipeline_uuid: str, update: app_types.EntityUpdate
):
    ev = models.PipelineUpdateEvent(
        type="project:pipeline:updated",
        project_uuid=project_uuid,
        pipeline_uuid=pipeline_uuid,
        update=update,
    )
    _register_event(ev)
