import copy
import os
import uuid

import pytest
from config import CONFIG_CLASS
from sqlalchemy_utils import drop_database

import app.core.sessions
from _orchest.internals.test_utils import AbortableAsyncResultMock, CeleryMock, uuid4
from app import create_app
from app.apis import namespace_environment_builds, namespace_jobs, namespace_runs
from app.connections import db


@pytest.fixture()
def celery(monkeypatch):
    celery = CeleryMock()
    for module in [namespace_environment_builds, namespace_runs, namespace_jobs]:
        monkeypatch.setattr(module, "make_celery", lambda *args, **kwargs: celery)
    return celery


@pytest.fixture()
def abortable_async_res(monkeypatch):

    aresult = AbortableAsyncResultMock("uuid")
    for module in [namespace_environment_builds, namespace_runs, namespace_jobs]:
        monkeypatch.setattr(
            module, "AbortableAsyncResult", lambda *args, **kwargs: aresult
        )
    return aresult


@pytest.fixture(scope="module")
def test_app():

    config = copy.deepcopy(CONFIG_CLASS)

    # Setup the DB URI.
    db_host = os.environ.get("ORCHEST_TEST_DATABASE_HOST", "localhost")
    db_port = os.environ.get("ORCHEST_TEST_DATABASE_PORT", "1337")
    # Postgres does not accept "-" as part of a name.
    db_name = str(uuid.uuid4()).replace("-", "_")
    db_name = "test_db"
    SQLALCHEMY_DATABASE_URI = f"postgresql://postgres@{db_host}:{db_port}/{db_name}"
    config.SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI

    config.TESTING = True
    app = create_app(config, use_db=True, be_scheduler=False)
    yield app

    drop_database(app.config["SQLALCHEMY_DATABASE_URI"])


@pytest.fixture()
def client(test_app):
    with test_app.test_client() as client:
        yield client

    # Remove all data, so that every test has access to a clean slate.
    with test_app.app_context():
        tables = db.engine.table_names()
        tables = [t for t in tables if t != "alembic_version"]
        tables = ",".join(tables)

        # RESTART IDENTITY is to reset sequence generators.
        cmd = f"TRUNCATE {tables} RESTART IDENTITY;"
        db.engine.execute(cmd)
        db.session.commit()


class Project:
    def __init__(self, client, uuid, env_variables=None):
        self.uuid = uuid
        project = {"uuid": self.uuid, "env_variables": env_variables}
        if env_variables is None:
            project["env_variables"] = {}

        client.post("/api/projects/", json=project)


@pytest.fixture()
def project(client):
    return Project(client, uuid4())


class Pipeline:
    def __init__(self, client, proj, uuid, env_variables=None):
        self.project = proj
        self.uuid = uuid
        pipeline = {
            "project_uuid": proj.uuid,
            "uuid": self.uuid,
            "env_variables": env_variables,
        }
        if env_variables is None:
            pipeline["env_variables"] = {}

        client.post("/api/pipelines/", json=pipeline)


@pytest.fixture()
def pipeline(client, project):
    return Pipeline(client, project, uuid4())


class InteractiveSession:
    def __init__(self, client, pipeline):
        self.project = pipeline.project
        self.pipeline = pipeline

        pipeline_spec = {
            "project_uuid": pipeline.project.uuid,
            "pipeline_uuid": pipeline.uuid,
            "pipeline_path": "pip_path",
            "project_dir": "project_dir",
            "host_userdir": "host_userdir",
        }
        client.post("/api/sessions/", json=pipeline_spec)


@pytest.fixture()
def interactive_session(client, pipeline, monkeypatch):
    monkeypatch.setattr(
        app.core.sessions.InteractiveSession, "launch", lambda *args, **kwargs: None
    )
    monkeypatch.setattr(
        app.core.sessions.InteractiveSession,
        "get_containers_IP",
        lambda *args, **kwargs: app.core.sessions.IP("ip1", "ip2"),
    )
    return InteractiveSession(client, pipeline)


class InteractiveRun:
    def __init__(self, client, pipeline):
        self.project = pipeline.project
        self.pipeline = pipeline
        irun_spec = {
            "pipeline_definition": {
                "name": "pipeline-name",
                "project_uuid": self.project.uuid,
                "uuid": self.pipeline.uuid,
                "settings": {},
                "parameters": {},
                "steps": {
                    "uuid-1": {
                        "incoming_connections": [],
                        "name": "step-1",
                        "uuid": "uuid-1",
                        "file_path": "",
                        "environment": 0.3,
                    },
                },
            },
            "uuids": [],
            "project_uuid": self.project.uuid,
            "run_type": "full",
            "run_config": {},
        }
        self.uuid = client.post("/api/runs/", json=irun_spec).get_json()["uuid"]


@pytest.fixture()
def interactive_run(client, pipeline, celery, monkeypatch):
    monkeypatch.setattr(
        namespace_runs, "lock_environment_images_for_run", lambda *args, **kwargs: {}
    )
    return InteractiveRun(client, pipeline)


class Job:
    def __init__(self, client, pipeline):
        self.project = pipeline.project
        self.pipeline = pipeline
        job_spec = {
            "uuid": uuid4(),
            "name": "job-name",
            "project_uuid": self.project.uuid,
            "pipeline_uuid": self.pipeline.uuid,
            "pipeline_name": "pipeline-name",
            "cron_schedule": None,
            "parameters": [{}],
            "pipeline_definition": {},
            "pipeline_run_spec": {},
            "scheduled_start": None,
            "strategy_json": {},
        }

        self.uuid = client.post("/api/jobs/", json=job_spec).get_json()["uuid"]


@pytest.fixture()
def job(client, pipeline):
    return Job(client, pipeline)
