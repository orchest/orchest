from flask import request
from flask_restful import Api, Resource

from app.models import BackgroundTask
from app.schemas import BackgroundTaskSchema


def register_background_tasks_view(app, db):
    background_task_schema = BackgroundTaskSchema()
    api = Api(app)

    class BackgroundTaskResource(Resource):
        def get(self, task_uuid):
            task = BackgroundTask.query.filter(BackgroundTask.uuid == task_uuid).first()

            if task is None:
                return "", 404

            return background_task_schema.dump(task)

        def put(self, task_uuid):

            task = BackgroundTask.query.filter(BackgroundTask.uuid == task_uuid).first()
            if task is None:
                return "", 404

            try:
                task.status = request.json["status"]
                task.code = request.json.get("code", None)
                task.result = request.json.get("result", None)
                db.session.commit()
            except Exception:
                db.session.rollback()
                return {"message": "Failed update operation."}, 500

            return background_task_schema.dump(task)

    api.add_resource(
        BackgroundTaskResource, "/async/background-tasks/<string:task_uuid>"
    )
