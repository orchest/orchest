import uuid

from sqlalchemy import UniqueConstraint, func
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.sql import expression, text

from app.connections import db


def str_uuid4():
    return str(uuid.uuid4())


class BaseModel(db.Model):
    __abstract__ = True

    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class Project(BaseModel):
    __tablename__ = "projects"

    uuid = db.Column(db.String(255), nullable=False, primary_key=True)
    # Actually the project name.
    path = db.Column(db.String(255), nullable=False, unique=True)
    # Can be: INITIALIZING, READY, DELETING, MOVING. The status is used
    # to avoid race conditions and inconsistencies when discovering new
    # projects or projects that were deleted through the filesystem,
    # given that discovery can be concurrent to project deletion or
    # creation or move.
    status = db.Column(
        db.String(15),
        unique=False,
        nullable=False,
        # The default value is rather important, so that people having
        # their db automatically migrated will have projects in a valid
        # state.
        server_default=text("'READY'"),
    )

    __table_args__ = (UniqueConstraint("uuid", "path"),)


class Pipeline(BaseModel):
    __tablename__ = "pipelines"

    uuid = db.Column(db.String(255), nullable=False, primary_key=True)
    project_uuid = db.Column(
        db.ForeignKey("projects.uuid", ondelete="CASCADE"), primary_key=True
    )
    path = db.Column(db.String(255), nullable=False)
    # Can be: READY, MOVING. The status is used
    # to avoid race conditions and inconsistencies when discovering new
    # pipelines or pipelines that were deleted through the filesystem,
    # given that discovery can be concurrent to a pipeline move.
    status = db.Column(
        db.String(15),
        unique=False,
        nullable=False,
        server_default=text("'READY'"),
    )


# This class is only serialized on disk, it's never stored in the
# database. The properties are stored in properties.json in the
# <project>/.orchest/environments/<environment_uuid>/. directory.
# to avoid unknowingly querying a table that will always be empty, the
# table is deleted
# see __init__ at around line 120, after the db is initialized
class Environment(BaseModel):
    __tablename__ = "environments"

    uuid = db.Column(
        db.String(255),
        unique=True,
        nullable=False,
        primary_key=True,
        # using a server_default would require to install a postgres
        # plugin, leaving it as an ORM-only default
        default=str_uuid4,
    )
    name = db.Column(db.String(255), unique=False, nullable=False)
    project_uuid = db.Column(db.String(255), unique=False, nullable=False)
    language = db.Column(db.String(255), nullable=False)

    # Startup script is stored as separate file (start_script.sh)
    setup_script = db.Column(db.String(255), server_default="")
    base_image = db.Column(db.String(255), nullable=False)
    gpu_support = db.Column(
        db.Boolean, nullable=False, server_default=expression.false()
    )

    def __repr__(self):
        return f"<Environment {self.name}:{self.base_image}:{self.uuid}>"


class SchedulerJob(BaseModel):
    """Latest run of a job assigned to a Scheduler."""

    __tablename__ = "scheduler_jobs"

    type = db.Column(db.String(50), primary_key=True)

    # Used to make sure different instances of the Scheduler (due to
    # multiple gunicorn workers) don't cause a job to be executed
    # multiple times.
    timestamp = db.Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    def __repr__(self):
        return f"<SchedulerJob: {self.type}>"
