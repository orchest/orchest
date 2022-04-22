"""Module to register events to keep track of.

This might/will be of interest for notifications, analytics, etc.
"""
from app import models, utils
from app.connections import db

_logger = utils.get_logger()


def _register_job_event(type: str, project_uuid: str, job_uuid: str):
    ev = models.JobEvent(type=type, project_uuid=project_uuid, job_uuid=job_uuid)
    db.session.add(ev)
    _logger.info(ev)


def registerJobCreated(project_uuid: str, job_uuid: str):
    """Adds a job creation event to the db, does not commit."""
    _register_job_event("project:job:created", project_uuid, job_uuid)


def registerJobStarted(project_uuid: str, job_uuid: str):
    """Adds a job started event to the db, does not commit."""
    _register_job_event("project:job:started", project_uuid, job_uuid)


def registerJobDeleted(project_uuid: str, job_uuid: str):
    """Adds a job deletion event to the db, does not commit.

    Currently not of much use given the deletion on cascade of proj and
    job FKs, might be altered later.
    """
    _register_job_event("project:job:deleted", project_uuid, job_uuid)


def registerJobCancelled(project_uuid: str, job_uuid: str):
    """Adds a job cancellation event to the db, does not commit."""
    _register_job_event("project:job:cancelled", project_uuid, job_uuid)


def registerJobFailed(project_uuid: str, job_uuid: str):
    """Adds a job failed event to the db, does not commit."""
    _register_job_event("project:job:failed", project_uuid, job_uuid)


def registerJobSucceeded(project_uuid: str, job_uuid: str):
    """Adds a job succeeded event to the db, does not commit."""
    _register_job_event("project:job:succeeded", project_uuid, job_uuid)
