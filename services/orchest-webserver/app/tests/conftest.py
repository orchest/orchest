import os

import pytest
from flask_migrate import upgrade
from sqlalchemy_utils import drop_database
from tests.test_utils import Pipeline, Project

from _orchest.internals import utils as _utils
from _orchest.internals.test_utils import gen_uuid
from app import config, create_app
from app.connections import db

BASEPATH = os.path.dirname(__file__)
TEMP_DIR = os.path.join(BASEPATH, "tmp-artifacts")


@pytest.fixture(scope="module")
def test_app():
    """Setup a flask application with a working db.

    Expects a postgres database service to be running. A new database
    will be created with a random name. The database is dropped at the
    end of scope of the fixture.
    """

    # Setup the DB URI.
    db_host = os.environ.get("ORCHEST_TEST_DATABASE_HOST", "localhost")
    db_port = os.environ.get("ORCHEST_TEST_DATABASE_PORT", "5432")
    # Postgres does not accept "-" as part of a name.
    db_name = gen_uuid(use_underscores=True)
    db_name = "test_db"
    SQLALCHEMY_DATABASE_URI = f"postgresql://postgres@{db_host}:{db_port}/{db_name}"
    config.TestingConfig.SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI
    config.CONFIG_CLASS = config.TestingConfig
    _utils.GlobalOrchestConfig._path = os.path.join(TEMP_DIR, "config.json")

    # Migrate DB
    app, _, _ = create_app(to_migrate_db=True)
    with app.app_context():
        upgrade()

    app, _, _ = create_app()
    yield app

    drop_database(app.config["SQLALCHEMY_DATABASE_URI"])
    try:
        os.remove(os.path.join(TEMP_DIR, "config.json"))
    except FileNotFoundError:
        # Config file was never created because default values were
        # never updated.
        ...


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
def project(test_app):
    """Provides a project backed by an entry in the db."""
    return Project(test_app, gen_uuid())


@pytest.fixture()
def pipeline(test_app, project):
    """Provides a pipeline backed by an entry in the db."""
    return Pipeline(test_app, project, gen_uuid())
