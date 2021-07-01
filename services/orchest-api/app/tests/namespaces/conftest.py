import copy
import os

import pytest
from sqlalchemy_utils import drop_database
from tests.test_utils import (
    EagerScheduler,
    EnvironmentBuild,
    InteractiveRun,
    InteractiveSession,
    Job,
    Pipeline,
    Project,
)

import app.core.sessions
from _orchest.internals.test_utils import AbortableAsyncResultMock, CeleryMock, gen_uuid
from app import create_app
from app.apis import (
    namespace_environment_builds,
    namespace_environment_images,
    namespace_jobs,
    namespace_runs,
)
from app.connections import db
from config import CONFIG_CLASS


@pytest.fixture()
def celery(monkeypatch):
    """Mock celery and access added and revoked tasks."""
    celery = CeleryMock()
    for module in [namespace_environment_builds, namespace_runs, namespace_jobs]:
        monkeypatch.setattr(module, "make_celery", lambda *args, **kwargs: celery)
    return celery


@pytest.fixture()
def abortable_async_res(monkeypatch):
    """Mock an AbortableAsyncResult and access abort()."""

    aresult = AbortableAsyncResultMock("uuid")
    for module in [namespace_environment_builds, namespace_runs, namespace_jobs]:
        monkeypatch.setattr(
            module, "AbortableAsyncResult", lambda *args, **kwargs: aresult
        )
    return aresult


@pytest.fixture(autouse=True)
def monkeypatch_image_utils(monkeypatch):
    monkeypatch.setattr(
        namespace_environment_images, "remove_if_dangling", lambda *args, **kwargs: None
    )
    monkeypatch.setattr(
        namespace_environment_images,
        "docker_images_list_safe",
        lambda *args, **kwargs: [],
    )
    monkeypatch.setattr(
        namespace_environment_images,
        "docker_images_rm_safe",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        namespace_jobs, "get_env_uuids_missing_image", lambda *args, **kwargs: []
    )


@pytest.fixture(scope="module")
def test_app():
    """Setup a flask application with a working db.

    Expects a postgres database service to be running. A new database
    will be created with a random name. The database is dropped at the
    end of scope of the fixture.
    """

    config = copy.deepcopy(CONFIG_CLASS)

    # Setup the DB URI.
    db_host = os.environ.get("ORCHEST_TEST_DATABASE_HOST", "localhost")
    db_port = os.environ.get("ORCHEST_TEST_DATABASE_PORT", "5432")
    # Postgres does not accept "-" as part of a name.
    db_name = gen_uuid(use_underscores=True)
    db_name = "test_db"
    SQLALCHEMY_DATABASE_URI = f"postgresql://postgres@{db_host}:{db_port}/{db_name}"
    config.SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI

    config.TESTING = True
    app = create_app(config, use_db=True, be_scheduler=False)
    scheduler = EagerScheduler(
        job_defaults={
            # Same settings as the "real" scheduler.
            "misfire_grace_time": 2 ** 31,
            "coalesce": False,
            "max_instances": 2 ** 31,
        }
    )
    app.config["SCHEDULER"] = scheduler
    scheduler.start()
    yield app

    drop_database(app.config["SQLALCHEMY_DATABASE_URI"])


@pytest.fixture()
def client(test_app):
    """Setup a flask test client.

    Will delete all data in the db at the end of the scope of the
    fixture.
    """

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


@pytest.fixture()
def project(client):
    """Provides a project backed by an entry in the db."""
    return Project(client, gen_uuid())


@pytest.fixture()
def pipeline(client, project):
    """Provides a pipeline backed by an entry in the db."""
    return Pipeline(client, project, gen_uuid())


@pytest.fixture()
def monkeypatch_interactive_session(monkeypatch):
    monkeypatch.setattr(
        app.core.sessions.InteractiveSession, "launch", lambda *args, **kwargs: None
    )
    monkeypatch.setattr(
        app.core.sessions.InteractiveSession,
        "get_containers_IP",
        lambda *args, **kwargs: app.core.sessions.IP("ip1", "ip2"),
    )


@pytest.fixture()
def interactive_session(client, pipeline, monkeypatch_interactive_session, monkeypatch):
    """Provides an interactive session backed by an entry in the db."""
    return InteractiveSession(client, pipeline)


@pytest.fixture()
def interactive_run(client, pipeline, celery, monkeypatch):
    """Provides an interactive run backed by an entry in the db."""
    monkeypatch.setattr(
        namespace_runs, "lock_environment_images_for_run", lambda *args, **kwargs: {}
    )
    return InteractiveRun(client, pipeline)


@pytest.fixture()
def job(client, pipeline):
    """Provides a job backed by an entry in the db."""
    return Job(client, pipeline)


@pytest.fixture()
def environment_build(client, celery, project):
    """Provides an env build backed by an entry in the db."""
    return EnvironmentBuild(client, project)


@pytest.fixture(autouse=True)
def monkeypatch_lock_environment_images(monkeypatch):
    monkeypatch.setattr(
        namespace_runs, "lock_environment_images_for_run", lambda *args, **kwargs: {}
    )
    monkeypatch.setattr(
        namespace_jobs, "lock_environment_images_for_job", lambda *args, **kwargs: {}
    )
