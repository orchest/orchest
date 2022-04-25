"""Module to register events to keep track of.

This might/will be of interest for notifications, analytics, etc.
"""
from app import models, utils
from app.connections import db

_logger = utils.get_logger()


def _register_job_event(type: str, project_uuid: str, job_uuid: str) -> None:
    ev = models.JobEvent(type=type, project_uuid=project_uuid, job_uuid=job_uuid)
    db.session.add(ev)
    _logger.info(ev)


def register_job_created(project_uuid: str, job_uuid: str) -> None:
    """Adds a job creation event to the db, does not commit."""
    _register_job_event("project:job:created", project_uuid, job_uuid)


def register_job_started(project_uuid: str, job_uuid: str) -> None:
    """Adds a job started event to the db, does not commit."""
    _register_job_event("project:job:started", project_uuid, job_uuid)


def register_job_deleted(project_uuid: str, job_uuid: str) -> None:
    """Adds a job deletion event to the db, does not commit.

    Currently not of much use given the deletion on cascade of proj and
    job FKs, might be altered later.
    """
    _register_job_event("project:job:deleted", project_uuid, job_uuid)


def register_job_cancelled(project_uuid: str, job_uuid: str) -> None:
    """Adds a job cancellation event to the db, does not commit."""
    _register_job_event("project:job:cancelled", project_uuid, job_uuid)


def register_job_failed(project_uuid: str, job_uuid: str) -> None:
    """Adds a job failed event to the db, does not commit."""
    _register_job_event("project:job:failed", project_uuid, job_uuid)


def register_job_succeeded(project_uuid: str, job_uuid: str) -> None:
    """Adds a job succeeded event to the db, does not commit."""
    _register_job_event("project:job:succeeded", project_uuid, job_uuid)


def _register_job_pipeline_run_event(
    type: str, project_uuid: str, job_uuid: str, pipeline_run_uuid: str
):
    ev = models.JobPipelineRunEvent(
        type=type,
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        pipeline_run_uuid=pipeline_run_uuid,
    )
    db.session.add(ev)
    _logger.info(ev)


def register_job_pipeline_run_created(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run created event to the db, doesn't commit."""
    _register_job_pipeline_run_event(
        "project:job:pipeline-run:created", project_uuid, job_uuid, pipeline_run_uuid
    )


def register_job_pipeline_run_started(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run started event to the db, doesn't commit."""
    _register_job_pipeline_run_event(
        "project:job:pipeline-run:started", project_uuid, job_uuid, pipeline_run_uuid
    )


def register_job_pipeline_run_cancelled(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run cancelled event to the db, doesn't commit."""
    _register_job_pipeline_run_event(
        "project:job:pipeline-run:cancelled", project_uuid, job_uuid, pipeline_run_uuid
    )


def register_job_pipeline_run_failed(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run failed event to the db, doesn't commit."""
    _register_job_pipeline_run_event(
        "project:job:pipeline-run:failed", project_uuid, job_uuid, pipeline_run_uuid
    )


def register_job_pipeline_run_deleted(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run deleted event to the db, doesn't commit."""
    _register_job_pipeline_run_event(
        "project:job:pipeline-run:deleted", project_uuid, job_uuid, pipeline_run_uuid
    )


def register_job_pipeline_run_succeeded(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run succeeded event to the db, doesn't commit."""
    _register_job_pipeline_run_event(
        "project:job:pipeline-run:succeeded", project_uuid, job_uuid, pipeline_run_uuid
    )
