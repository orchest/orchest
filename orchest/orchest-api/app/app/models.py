from app.connections import db


class BaseModel:
    def as_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class Launch(BaseModel, db.Model):
    __tablename__ = 'launches'
    pipeline_uuid = db.Column(db.String(36), primary_key=True)
    server_ip = db.Column(db.String(15), unique=True, nullable=False)  # IPv4
    server_info = db.Column(db.JSON, unique=True, nullable=False)

    def __repr__(self):
        return f'<Launch {self.pipeline_uuid}>'


class Run(BaseModel, db.Model):
    __tablename__ = 'runs'
    run_uuid = db.Column(db.String(36), primary_key=True)
    pipeline_uuid = db.Column(db.String(36), unique=False, nullable=False)
    status = db.Column(db.String(15), unique=False, nullable=True)
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


# TODO: make DRY, need to:
#   have ScheduledRun inherit from Run so we don't repeat fields but this inheritance
#   must be implemented so that ScheduledRun is it's own table and does not refer to Run in any way
#   since ScheduledRun is on it's own database
class ScheduledRun(BaseModel, db.Model):
    __tablename__ = 'scheduled_runs'
    __bind_key__ = 'persistent_db'

    run_uuid = db.Column(db.String(36), primary_key=True)
    pipeline_uuid = db.Column(db.String(36), unique=False, nullable=False)
    status = db.Column(db.String(15), unique=False, nullable=True)
    step_statuses = db.relationship('ScheduledStepStatus', lazy='joined')

    scheduled_start = db.Column(db.DateTime, nullable=False)

    
    def __repr__(self):
        return f'<ScheduledRun {self.run_uuid}>'


# TODO: ScheduledStepStatus should just be StepStatus. Need to have StepStatus exist in two seperate
# databases at a time, where one has a foreign key to Run and the other has a foreign key to ScheduledRun
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
