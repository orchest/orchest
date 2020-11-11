from flask_restful import Api, Resource
from flask import request
import os
import subprocess
from subprocess import Popen
import uuid

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

    class ImportGitProjectListResource(Resource):
        def post(self):
            # url = request.json["url"]
            # project_name = request.json["project_name"]

            n_uuid = str(uuid.uuid4())
            new_task = BackgroundTask(
                task_uuid=n_uuid, task_type="GIT_CLONE_PROJECT", status="PENDING"
            )
            db.session.add(new_task)
            db.session.commit()

            # start the background process in charge of cloning
            file_dir = os.path.dirname(os.path.realpath(__file__))
            background_task_process = Popen(
                [
                    "python3",
                    "-m",
                    "scripts.background_tasks",
                    "--type",
                    "git_clone_project",
                    "--uuid",
                    n_uuid,
                    "--url",
                    request.json["url"],
                    "--path",
                    request.json["project_name"],
                ],
                cwd=os.path.join(file_dir, "../.."),
                stderr=subprocess.STDOUT,
            )

            return background_task_schema.dump(new_task)

    api.add_resource(ImportGitProjectListResource, "/async/import-git")
    api.add_resource(
        BackgroundTaskResource, "/async/background-task/<string:task_uuid>"
    )
