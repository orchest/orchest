from app.connections import db


class BaseModel:
    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class InteractiveSession(BaseModel, db.Model):
    __tablename__ = 'interactive_sessions'
    pipeline_uuid = db.Column(
        db.String(36),
        primary_key=True
    )
    # Docker container IDs.
    container_ids = db.Column(
        db.JSON,
        unique=False,
        nullable=False,
    )
    # Used to connect to Jupyter notebook server.
    jupyter_server_ip = db.Column(
        db.String(15),
        unique=True,
        nullable=False
    )  # IPv4
    # Used to connect to Jupyter notebook server.
    notebook_server_info = db.Column(
        db.JSON,
        unique=True,
        nullable=False
    )

    def __repr__(self):
        return f'<Launch {self.pipeline_uuid}>'


class Run(BaseModel, db.Model):
    __tablename__ = 'runs'
    run_uuid = db.Column(
        db.String(36),
        primary_key=True
    )
    pipeline_uuid = db.Column(
        db.String(36),
        unique=False,
        nullable=False
    )
    status = db.Column(
        db.String(15),
        unique=False,
        nullable=True
    )
    step_statuses = db.relationship('StepStatus', lazy='joined')

    def __repr__(self):
        return f'<Run {self.run_uuid}>'


class StepStatus(BaseModel, db.Model):
    __tablename__ = 'stepstatus'
    run_uuid = db.Column(
        db.String(36),
        db.ForeignKey('runs.run_uuid'),
        primary_key=True
    )
    step_uuid = db.Column(
        db.String(36),
        primary_key=True
    )
    status = db.Column(
        db.String(15),
        unique=False,
        nullable=True
    )
    started_time = db.Column(
        db.DateTime,
        unique=False,
        nullable=True
    )
    ended_time = db.Column(
        db.DateTime,
        unique=False,
        nullable=True
    )

    def __repr__(self):
        return f'<StepStatus {self.run_uuid}.{self.step_uuid}>'


# TODO: We want dynamic binds so that the exact same model can be used
#       for pipeline runs that are part of an experiment and ones that
#       are run interactively. Possibly we can use:
#       https://github.com/pallets/flask-sqlalchemy/issues/107
#       Additionally, the `scheduled_start` would have to be added to
#       the `Run` model together with ``default=datetime.utcnow``.
#       https://docs.sqlalchemy.org/en/13/orm/persistence_techniques.html#custom-vertical-partitioning
#       NOTE: binds are specified at a model's declaration time, thus we
#       need a way to do dynamic binds.
class ScheduledRun(BaseModel, db.Model):
    __tablename__ = 'scheduled_runs'
    __bind_key__ = 'persistent_db'

    run_uuid = db.Column(
        db.String(36),
        primary_key=True
    )
    pipeline_uuid = db.Column(
        db.String(36),
        unique=False,
        nullable=False
    )
    status = db.Column(
        db.String(15),
        unique=False,
        nullable=True
    )
    scheduled_start = db.Column(
        db.DateTime,
        nullable=False
    )
    step_statuses = db.relationship('ScheduledStepStatus', lazy='joined')

    def __repr__(self):
        return f'<ScheduledRun {self.run_uuid}>'


# TODO: ScheduledStepStatus should just be StepStatus. Need to have
# StepStatus exist in two seperate databases at a time, where one has a
# foreign key to Run and the other has a foreign key to ScheduledRun
class ScheduledStepStatus(BaseModel, db.Model):
    __tablename__ = 'scheduled_stepstatus'
    __bind_key__ = 'persistent_db'
    run_uuid = db.Column(
        db.String(36),
        db.ForeignKey('scheduled_runs.run_uuid'),
        primary_key=True
    )
    step_uuid = db.Column(
        db.String(36),
        primary_key=True
    )
    status = db.Column(
        db.String(15),
        unique=False,
        nullable=True
    )
    started_time = db.Column(
        db.DateTime,
        unique=False,
        nullable=True
    )
    ended_time = db.Column(
        db.DateTime,
        unique=False,
        nullable=True
    )

    def __repr__(self):
        return f'<StepStatus {self.run_uuid}.{self.step_uuid}>'


class Experiment(BaseModel, db.Model):
    __tablename__ = 'experiments'
    __bind_key__ = 'persistent_db'

    experiment_uuid = db.Column(
        db.String(36),
        primary_key=True
    )
    pipeline_uuid = db.Column(
        db.String(36),
        primary_key=False
    )
    # status = db.Column(
    #     db.String(15),
    #     unique=False,
    #     nullable=True
    # )
    # started_time = db.Column(
    #     db.DateTime,
    #     unique=False,
    #     nullable=True
    # )
    # ended_time = db.Column(
    #     db.DateTime,
    #     unique=False,
    #     nullable=True
    # )
    scheduled_start = db.Column(
        db.DateTime,
        nullable=False
    )
    pipeline_runs = db.relationship('NonInteractiveRun', lazy='joined')

    def __repr__(self):
        return f'<StepStatus {self.run_uuid}.{self.step_uuid}>'


class NonInteractiveRun(BaseModel, db.Model):
    __tablename__ = 'non_interactive_runs'
    __bind_key__ = 'persistent_db'

    experiment_uuid = db.Column(
        db.String(36),
        db.ForeignKey('experiments.experiment_uuid'),
        primary_key=True
    )
    run_uuid = db.Column(
        db.String(36),
        primary_key=True
    )
    pipeline_uuid = db.Column(
        db.String(36),
        unique=False,
        nullable=False
    )
    status = db.Column(
        db.String(15),
        unique=False,
        nullable=True
    )
    step_statuses = db.relationship('NonInteractiveRunStep', lazy='joined')

    scheduled_start = db.Column(
        db.DateTime,
        nullable=False
    )

    started_time = db.Column(
        db.DateTime,
        unique=False,
        nullable=True
    )
    ended_time = db.Column(
        db.DateTime,
        unique=False,
        nullable=True
    )

    def __repr__(self):
        return f'<StepStatus {self.run_uuid}.{self.step_uuid}>'


class NonInteractiveRunStep(BaseModel, db.Model):
    __tablename__ = 'non_interactive_run_steps'
    __bind_key__ = 'persistent_db'

    experiment_uuid = db.Column(
        db.String(36),
        db.ForeignKey('experiments.experiment_uuid'),
        primary_key=True
    )
    run_uuid = db.Column(
        db.String(36),
        db.ForeignKey('non_interactive_runs.run_uuid'),
        primary_key=True
    )
    step_uuid = db.Column(
        db.String(36),
        primary_key=True
    )
    status = db.Column(
        db.String(15),
        unique=False,
        nullable=True
    )
    started_time = db.Column(
        db.DateTime,
        unique=False,
        nullable=True
    )
    ended_time = db.Column(
        db.DateTime,
        unique=False,
        nullable=True
    )

    def __repr__(self):
        return f'<StepStatus {self.run_uuid}.{self.step_uuid}>'
