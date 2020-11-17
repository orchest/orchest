from app.connections import db
from sqlalchemy import UniqueConstraint
import datetime
import uuid


def str_uuid4():
    return str(uuid.uuid4())


class Project(db.Model):
    __tablename__ = "project"

    uuid = db.Column(db.String(255), nullable=False, primary_key=True)
    path = db.Column(db.String(255), nullable=False)

    __table_args__ = (UniqueConstraint("uuid", "path"),)


class Pipeline(db.Model):
    __tablename__ = "pipeline"

    uuid = db.Column(db.String(255), nullable=False, primary_key=True)
    project_uuid = db.Column(db.ForeignKey("project.uuid"), primary_key=True)
    path = db.Column(db.String(255), nullable=False)

    __table_args__ = (UniqueConstraint("uuid", "project_uuid"),)


class DataSource(db.Model):
    __tablename__ = "datasources"

    name = db.Column(db.String(255), unique=True, nullable=False, primary_key=True)
    source_type = db.Column(db.String(100), nullable=False)
    connection_details = db.Column(db.JSON, nullable=False)
    created = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)

    def __repr__(self):
        return f"<DataSource {self.name}:{self.source_type}>"


# This class is only serialized on disk, it's never stored in the database
# The properties are stored in properties.json in the
# <project>/.orchest/environments/<environment_uuid>/. directory.
class Environment(db.Model):
    __tablename__ = "environments"

    # Note: uuids for environments need to be unique across all environments.
    # This needs to be checked on project import (to check for conflicting environment uuids).
    uuid = db.Column(
        db.String(255), unique=True, nullable=False, primary_key=True, default=str_uuid4
    )
    name = db.Column(db.String(255), unique=False, nullable=False)
    project_uuid = db.Column(db.String(255), unique=False, nullable=False)
    language = db.Column(db.String(255), nullable=False)

    # Startup script is stored as separate file (start_script.sh)
    # TODO: find a clean way of using internal config._ENV_SETUP_SCRIPT_PROPERTY_NAME as the column name
    setup_script = db.Column(db.String(255), default="")
    base_image = db.Column(db.String(255), nullable=False)
    gpu_support = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f"<Environment {self.name}:{self.base_image}:{self.uuid}>"


class Experiment(db.Model):
    __tablename__ = "experiments"

    name = db.Column(db.String(255), unique=False, nullable=False)
    uuid = db.Column(db.String(255), unique=True, nullable=False, primary_key=True)
    pipeline_uuid = db.Column(db.String(255), unique=False, nullable=False)
    project_uuid = db.Column(db.String(255), unique=False, nullable=False)
    pipeline_name = db.Column(db.String(255), unique=False, nullable=False)
    created = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)
    strategy_json = db.Column(db.Text, nullable=False)
    draft = db.Column(db.Boolean())


class PipelineRun(db.Model):
    __tablename__ = "pipelineruns"

    uuid = db.Column(db.String(255), unique=True, nullable=False, primary_key=True)
    id = db.Column(db.Integer(), unique=False)
    experiment = db.Column(db.ForeignKey("experiments.uuid"))
    parameter_json = db.Column(db.JSON, nullable=False)


class BackgroundTask(db.Model):
    """BackgroundTasks, a catch all model for tasks to be run in the background."""

    __tablename__ = "background_tasks"

    task_uuid = db.Column(db.String(36), primary_key=True, unique=True, nullable=False)
    # see background_task_executor types
    task_type = db.Column(db.String(15), unique=False, nullable=True)
    status = db.Column(db.String(15), unique=False, nullable=False)
    code = db.Column(db.String(15), unique=False, nullable=True)
    result = db.Column(db.String(), unique=False, nullable=True)

    def __repr__(self):
        return f"<BackgroundTask: {self.task_uuid}>"
