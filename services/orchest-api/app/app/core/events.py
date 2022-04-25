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


def _register_cronjob_event(type: str, project_uuid: str, job_uuid: str) -> None:
    ev = models.CronJobEvent(type=type, project_uuid=project_uuid, job_uuid=job_uuid)
    db.session.add(ev)
    _logger.info(ev)


def _is_cronjob(job_uuid: str) -> bool:
    return (
        db.session.query(models.Job.schedule).filter(models.Job.uuid == job_uuid).one()
    ).schedule is not None


def register_job_created(project_uuid: str, job_uuid: str) -> None:
    """Adds a job creation event to the db, does not commit."""
    if _is_cronjob(job_uuid):
        _register_cronjob_event("project:cronjob:created", project_uuid, job_uuid)
    else:
        _register_job_event("project:job:created", project_uuid, job_uuid)


def register_job_started(project_uuid: str, job_uuid: str) -> None:
    """Adds a job started event to the db, does not commit."""
    if _is_cronjob(job_uuid):
        _register_cronjob_event("project:cronjob:started", project_uuid, job_uuid)
    else:
        _register_job_event("project:job:started", project_uuid, job_uuid)


def register_job_deleted(project_uuid: str, job_uuid: str) -> None:
    """Adds a job deletion event to the db, does not commit.

    Currently not of much use given the deletion on cascade of proj and
    job FKs, might be altered later.
    """
    if _is_cronjob(job_uuid):
        _register_cronjob_event("project:cronjob:deleted", project_uuid, job_uuid)
    else:
        _register_job_event("project:job:deleted", project_uuid, job_uuid)


def register_job_cancelled(project_uuid: str, job_uuid: str) -> None:
    """Adds a job cancellation event to the db, does not commit."""
    if _is_cronjob(job_uuid):
        _register_cronjob_event("project:cronjob:cancelled", project_uuid, job_uuid)
    else:
        _register_job_event("project:job:cancelled", project_uuid, job_uuid)


def register_job_failed(project_uuid: str, job_uuid: str) -> None:
    """Adds a job failed event to the db, does not commit."""
    if _is_cronjob(job_uuid):
        _register_cronjob_event("project:cronjob:failed", project_uuid, job_uuid)
    else:
        _register_job_event("project:job:failed", project_uuid, job_uuid)


def register_job_succeeded(project_uuid: str, job_uuid: str) -> None:
    """Adds a job succeeded event to the db, does not commit."""
    _register_job_event("project:job:succeeded", project_uuid, job_uuid)


def register_cronjob_paused(project_uuid: str, job_uuid: str) -> None:
    """Adds a cronjob paused event to the db, does not commit."""
    _register_job_event("project:cronjob:paused", project_uuid, job_uuid)


def register_cronjob_unpaused(project_uuid: str, job_uuid: str) -> None:
    """Adds a cronjob unpaused event to the db, does not commit."""
    _register_job_event("project:cronjob:unpaused", project_uuid, job_uuid)


def register_cronjob_run_started(
    project_uuid: str, job_uuid: str, run_index: int
) -> None:
    """Adds a cronjob run started event to the db, does not commit."""
    ev = models.CronJobRunEvent(
        type="project:cronjob:run:started",
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        run_index=run_index,
    )

    db.session.add(ev)
    _logger.info(ev)


def register_cronjob_run_succeeded(
    project_uuid: str, job_uuid: str, run_index: int
) -> None:
    """Adds a cronjob run succeeded event to the db, does not commit."""
    ev = models.CronJobRunEvent(
        type="project:cronjob:run:succeeded",
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        run_index=run_index,
    )

    db.session.add(ev)
    _logger.info(ev)


def register_cronjob_run_failed(
    project_uuid: str, job_uuid: str, run_index: int
) -> None:
    """Adds a cronjob run failed event to the db, does not commit."""
    ev = models.CronJobRunEvent(
        type="project:cronjob:run:failed",
        project_uuid=project_uuid,
        job_uuid=job_uuid,
        run_index=run_index,
    )

    db.session.add(ev)
    _logger.info(ev)


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


def _register_cronjob_run_pipeline_run_event(
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
    db.session.add(ev)
    _logger.info(ev)


def register_job_pipeline_run_created(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run created event to the db, doesn't commit."""
    if _is_cronjob(job_uuid):
        _register_cronjob_run_pipeline_run_event(
            "project:cronjob:run:pipeline-run:created",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    else:
        _register_job_pipeline_run_event(
            "project:job:pipeline-run:created",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )


def register_job_pipeline_run_started(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run started event to the db, doesn't commit."""
    if _is_cronjob(job_uuid):
        _register_cronjob_run_pipeline_run_event(
            "project:cronjob:run:pipeline-run:started",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    else:
        _register_job_pipeline_run_event(
            "project:job:pipeline-run:started",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )


def register_job_pipeline_run_cancelled(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run cancelled event to the db, doesn't commit."""
    if _is_cronjob(job_uuid):
        _register_cronjob_run_pipeline_run_event(
            "project:cronjob:run:pipeline-run:cancelled",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    else:
        _register_job_pipeline_run_event(
            "project:job:pipeline-run:cancelled",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )


def register_job_pipeline_run_failed(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run failed event to the db, doesn't commit."""
    if _is_cronjob(job_uuid):
        _register_cronjob_run_pipeline_run_event(
            "project:cronjob:run:pipeline-run:failed",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    else:
        _register_job_pipeline_run_event(
            "project:job:pipeline-run:failed", project_uuid, job_uuid, pipeline_run_uuid
        )


def register_job_pipeline_run_deleted(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run deleted event to the db, doesn't commit."""
    if _is_cronjob(job_uuid):
        _register_cronjob_run_pipeline_run_event(
            "project:cronjob:run:pipeline-run:deleted",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    else:
        _register_job_pipeline_run_event(
            "project:job:pipeline-run:deleted",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )


def register_job_pipeline_run_succeeded(
    project_uuid: str, job_uuid: str, pipeline_run_uuid: str
) -> None:
    """Adds a job ppl run succeeded event to the db, doesn't commit."""
    if _is_cronjob(job_uuid):
        _register_cronjob_run_pipeline_run_event(
            "project:cronjob:run:pipeline-run:succeeded",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
    else:
        _register_job_pipeline_run_event(
            "project:job:pipeline-run:succeeded",
            project_uuid,
            job_uuid,
            pipeline_run_uuid,
        )
