from app.connections import db
import datetime


class DataSource(db.Model):
    __tablename__ = 'datasources'

    name = db.Column(db.String(255), unique=True, nullable=False, primary_key=True)
    source_type = db.Column(db.String(100), nullable=False)
    connection_details = db.Column(db.JSON, nullable=False)
    created = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)

    def __repr__(self):
        return f'<DataSource {self.name}:{self.source_type}>'


class Experiment(db.Model):
    __tablename__ = 'experiments'

    name = db.Column(db.String(255), unique=False, nullable=False)
    uuid = db.Column(db.String(255), unique=True, nullable=False, primary_key=True)
    pipeline_uuid = db.Column(db.String(255), unique=False, nullable=False)
    pipeline_name = db.Column(db.String(255), unique=False, nullable=False)
    created = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)
    strategy_json = db.Column(db.Text, nullable=False)


class PipelineRun(db.Model):
    __tablename__ = 'pipelineruns'

    uuid = db.Column(db.String(255), unique=True, nullable=False, primary_key=True)
    id = db.Column(db.Integer(), unique=False)
    experiment = db.Column(db.ForeignKey("experiments.uuid"))
    parameter_json = db.Column(db.Text, nullable=False)