"""Module to register events to keep track of.

Upon the registration of an event in the db, deliveries are created
accordingly based on any subscribers subscribed to the event type that
happened.
"""
from app import models, utils
from app.connections import db
from app.core import notifications

_logger = utils.get_logger()


def _register_event(ev: models.Event) -> None:
    db.session.add(ev)
    _logger.info(ev)

    project_uuid = None
    job_uuid = None
    if isinstance(ev, models.ProjectEvent):
        project_uuid = ev.project_uuid
    # Don't use a else if, JobEvent ISA ProjectEvent.
    if isinstance(ev, models.JobEvent):
        job_uuid = ev.job_uuid

    db.session.flush()

    subscribers = notifications.get_subscribers_subscribed_to_event(
        ev.type, project_uuid=project_uuid, job_uuid=job_uuid
    )
    for sub in subscribers:
        _logger.info(
            f"Scheduling delivery for event {ev.uuid}, event type: {ev.type} for "
            f"deliveree {sub.uuid}."
        )
        delivery = models.Delivery(
            event=ev.uuid,
            deliveree=sub.uuid,
            status="SCHEDULED",
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
    ev = models.CronJobRunEvent(
        type="project:cron-job:run:started",
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        run_index=run_index,
    )
    _register_event(ev)


def register_cron_job_run_succeeded(
    project_uuid: str, job_uuid: str, run_index: int
) -> None:
    """Adds a cron-job run succeeded to the db, doesn't commit."""
    ev = models.CronJobRunEvent(
        type="project:cron-job:run:succeeded",
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        run_index=run_index,
    )
    _register_event(ev)


def register_cron_job_run_failed(
    project_uuid: str, job_uuid: str, run_index: int
) -> None:
    """Adds a cron-job run failed to the db, doesn't commit."""
    ev = models.CronJobRunEvent(
        type="project:cron-job:run:failed",
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        run_index=run_index,
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
    ev = models.CronJobRunPipelineRunEvent(
        type=type,
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        pipeline_run_uuid=pipeline_run_uuid,
        run_index=run_index,
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
