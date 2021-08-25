from app import models
from app.connections import db


class Project:
    def __init__(self, app, uuid, path="my-project", status="READY"):
        self.uuid = uuid
        with app.app_context():
            project = models.Project(uuid=uuid, path=path, status=status)
            db.session.add(project)
            db.session.commit()


class Pipeline:
    def __init__(self, app, proj, uuid, path="my-pipeline", status="READY"):
        self.project = proj
        self.uuid = uuid
        with app.app_context():
            pipeline = models.Pipeline(
                project_uuid=proj.uuid, uuid=uuid, path=path, status=status
            )
            db.session.add(pipeline)
            db.session.commit()


class MockRequestReponse:
    def __init__(self, status_code=200, json=None):
        self.status_code = status_code
        self._json = json
        self.content = {}
        self.headers = {}

    def __exit__(self, *args, **kwargs):
        pass

    def json(self):
        return self._json
