from app.connections import db
import datetime


class DataSource(db.Model):
    __tablename__ = "datasources"

    name = db.Column(db.String(255), unique=True, nullable=False, primary_key=True)
    source_type = db.Column(db.String(100), nullable=False)
    connection_details = db.Column(db.JSON, nullable=False)
    created = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)

    def __repr__(self):
        return f"<DataSource {self.name}:{self.source_type}>"


class Image(db.Model):
    __tablename__ = "images"

    name = db.Column(db.String(255), unique=True, nullable=False, primary_key=True)
    language = db.Column(db.String(255), nullable=False)
    created = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)

    def __repr__(self):
        return f"<Images {self.name}:{self.language}>"


class Commit(db.Model):
    __tablename__ = "commits"

    uuid = db.Column(db.String(255), unique=True, nullable=False, primary_key=True)
    tag = db.Column(db.String(255), unique=False, nullable=False)
    name = db.Column(db.String(255), unique=False, nullable=False)
    base_image = db.Column(db.ForeignKey("images.name"))
    created = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)
    building = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f"<Commit {self.name}:{self.base_image}:{self.uuid}>"


class Experiment(db.Model):
    __tablename__ = "experiments"

    name = db.Column(db.String(255), unique=False, nullable=False)
    uuid = db.Column(db.String(255), unique=True, nullable=False, primary_key=True)
    pipeline_uuid = db.Column(db.String(255), unique=False, nullable=False)
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
