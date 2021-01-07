from flask import request
from flask_restful import Api, Resource

from app.models import BackgroundTask
from app.schemas import BackgroundTaskSchema


def register_background_tasks_view(app, db):
    background_task_schema = BackgroundTaskSchema()
    api = Api(app)

    class BackgroundTaskResource(Resource):
        def get(self, task_uuid):
            task = BackgroundTask.query.filter(
                BackgroundTask.task_uuid == task_uuid
            ).first()

            if task is None:
                return "", 404

            return background_task_schema.dump(task)

        def put(self, task_uuid):

            task = BackgroundTask.query.filter(
                BackgroundTask.task_uuid == task_uuid
            ).first()
            if task is None:
                return "", 404

            task.status = request.json["status"]
            task.code = request.json.get("code", None)
            task.result = request.json.get("result", None)
            db.session.commit()

            return background_task_schema.dump(task)

    api.add_resource(
        BackgroundTaskResource, "/async/background-tasks/<string:task_uuid>"
    )
