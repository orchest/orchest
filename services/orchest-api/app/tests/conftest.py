import copy
import os
import uuid

import pytest
from config import CONFIG_CLASS
from sqlalchemy_utils import drop_database

from app import create_app
from app.connections import db


@pytest.fixture(scope="module", autouse=True)
def test_app():
    print("APP")

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
    print("CLIENT")
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
def uuid4():
    yield lambda: str(uuid.uuid4())


class Project:
    def __init__(self, client, uuid4, env_variables=None):
        self.uuid = uuid4()
        project = {"uuid": self.uuid, "env_variables": env_variables}
        if env_variables is None:
            project["env_variables"] = {}

        client.post("/api/projects/", json=project)


@pytest.fixture()
def project(client, uuid4):
    yield Project(client, uuid4)
