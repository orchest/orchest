import uuid
from datetime import datetime
from typing import Optional

from celery.contrib.abortable import AbortableAsyncResult
from flask import abort, current_app, request
from flask_restx import Namespace, Resource, marshal
from sqlalchemy import desc, or_

import app.models as models
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema
from app.connections import db
from app.core import events
from app.errors import SessionInProgressException
from app.utils import update_status_db, upsert_cluster_node
from config import CONFIG_CLASS

api = Namespace("jupyter-builds", description="Build Jupyter server image")
api = schema.register_schema(api)


@api.route("/")
class JupyterEnvironmentBuildList(Resource):
    @api.doc("get_jupyter_image_builds")
    @api.marshal_with(schema.jupyter_image_builds)
    def get(self):
        """Fetches all jupyter builds (past and present).

        The jupyter builds are either PENDING, STARTED, SUCCESS,
        FAILURE, ABORTED.

        """
        jupyter_image_builds = models.JupyterImageBuild.query.all()

        return (
            {
                "jupyter_image_builds": [
                    jupyter_image_build.as_dict()
                    for jupyter_image_build in jupyter_image_builds
                ]
            },
            200,
        )

    @api.doc("start_jupyter_image_build")
    def post(self):
        """Queues a Jupyter build."""
        try:
            with TwoPhaseExecutor(db.session) as tpe:
                jupyter_image_build = CreateJupyterEnvironmentBuild(tpe).transaction()
        except SessionInProgressException:
            return {"message": "SessionInProgressException"}, 500
        except Exception as e:
            current_app.logger.error(e)
            jupyter_image_build = None

        if jupyter_image_build is not None:
            return_data = {"jupyter_image_build": jupyter_image_build}
            return_code = 200
        else:
            return_data = {}
            return_code = 500

        return (
            marshal(return_data, schema.jupyter_image_build_request_result),
            return_code,
        )


@api.route(
    "/<string:jupyter_image_build_uuid>",
)
@api.param("jupyter_image_build_uuid", "UUID of the JupyterEnvironmentBuild")
@api.response(404, "Jupyter build not found")
class JupyterEnvironmentBuild(Resource):
    @api.doc("get_jupyter_image_build")
    @api.marshal_with(schema.jupyter_image_build, code=200)
    def get(self, jupyter_image_build_uuid):
        """Fetch a Jupyter build given its uuid. #CLOUD"""
        jupyter_image_build = models.JupyterImageBuild.query.filter_by(
            uuid=jupyter_image_build_uuid
        ).one_or_none()
        if jupyter_image_build is not None:
            return jupyter_image_build.as_dict()
        abort(404, "JupyterEnvironmentBuild not found.")

    @api.doc("set_jupyter_image_build_status")
    @api.expect(schema.status_update)
    def put(self, jupyter_image_build_uuid):
        """Set the status of a jupyter build."""
        status_update = request.get_json()

        filter_by = {
            "uuid": jupyter_image_build_uuid,
        }
        try:
            if status_update.get("cluster_node") is not None:
                upsert_cluster_node(status_update["cluster_node"])

            update_status_db(
                status_update,
                model=models.JupyterImageBuild,
                filter_by=filter_by,
            )
            if status_update["status"] == "SUCCESS":
                build = models.JupyterImageBuild.query.filter(
                    models.JupyterImageBuild.uuid == jupyter_image_build_uuid
                ).one()
                db.session.add(
                    models.JupyterImage(
                        tag=build.image_tag,
                        base_image_version=CONFIG_CLASS.ORCHEST_VERSION,
                        stored_in_registry=False,
                    )
                )
                if build.cluster_node is None:
                    raise Exception("Build cluster_node not set.")
                db.session.add(
                    models.JupyterImageOnNode(
                        jupyter_image_tag=build.image_tag,
                        node_name=build.cluster_node,
                    )
                )
                events.register_jupyter_image_build_succeeded(jupyter_image_build_uuid)
            else:
                if status_update["status"] == "STARTED":
                    events.register_jupyter_image_build_started(
                        jupyter_image_build_uuid
                    )
                elif status_update["status"] == "FAILURE":
                    events.register_jupyter_image_build_failed(jupyter_image_build_uuid)
            db.session.commit()
        except Exception as e:
            current_app.logger.error(e)
            db.session.rollback()
            return {"message": "Failed update operation."}, 500

        return {"message": "Status was updated successfully."}, 200

    @api.doc("delete_jupyter_image_build")
    @api.response(200, "Jupyter build cancelled or stopped ")
    def delete(self, jupyter_image_build_uuid):
        """Stops a Jupyter build given its UUID.

        However, it will not delete any corresponding database entries,
        it will update the status of corresponding objects to ABORTED.
        """
        try:
            with TwoPhaseExecutor(db.session) as tpe:
                could_abort = AbortJupyterEnvironmentBuild(tpe).transaction(
                    jupyter_image_build_uuid
                )
        except Exception as e:
            return {"message": str(e)}, 500

        if could_abort:
            return {"message": "Jupyter build termination was successfull."}, 200
        else:
            return {"message": "Jupyter build does not exist or is not running."}, 400


@api.route(
    "/most-recent/",
)
class MostRecentJupyterEnvironmentBuild(Resource):
    @api.doc("get_project_most_recent_jupyter_image_build")
    @api.marshal_with(schema.jupyter_image_builds, code=200)
    def get(self):
        """Get the most recent Jupyter build."""

        # Filter by project uuid. Use a window function to get the most
        # recently requested build for each environment return.
        jupyter_image_builds = (
            models.JupyterImageBuild.query.order_by(
                models.JupyterImageBuild.requested_time.desc()
            )
            .limit(1)
            .all()
        )

        return {
            "jupyter_image_builds": [build.as_dict() for build in jupyter_image_builds]
        }


class CreateJupyterEnvironmentBuild(TwoPhaseFunction):
    def _transaction(self):
        # Check if there are any active sessions
        active_session_count = models.InteractiveSession.query.filter(
            or_(
                models.InteractiveSession.status == "LAUNCHING",
                models.InteractiveSession.status == "RUNNING",
                models.InteractiveSession.status == "STOPPING",
            )
        ).count()

        if active_session_count > 0:
            raise SessionInProgressException()

        # Abort any Jupyter build that is
        # already running, given by the status of PENDING/STARTED.
        already_running_builds = models.JupyterImageBuild.query.filter(
            or_(
                models.JupyterImageBuild.status == "PENDING",
                models.JupyterImageBuild.status == "STARTED",
            ),
        ).all()

        for build in already_running_builds:
            AbortJupyterEnvironmentBuild(self.tpe).transaction(build.uuid)

        # We specify the task id beforehand so that we can commit to the
        # db before actually launching the task, since the task might
        # make some calls to the orchest-api referring to itself (e.g.
        # a status update), and thus expecting to find itself in the db.
        # This way we avoid race conditions.
        task_id = str(uuid.uuid4())

        latest_jupyter_img_build = (
            models.JupyterImageBuild.query.with_for_update()
            .filter(models.JupyterImageBuild.image_tag.is_not(None))
            .order_by(desc(models.JupyterImageBuild.image_tag))
            .first()
        )
        if latest_jupyter_img_build is None:
            image_tag = 1
        else:
            image_tag = latest_jupyter_img_build.image_tag + 1

        # TODO: verify if forget has the same effect of
        # ignore_result=True because ignore_result cannot be used with
        # abortable tasks.
        # https://stackoverflow.com/questions/9034091/how-to-check-task-status-in-celery
        # task.forget()

        jupyter_image_build = {
            "uuid": task_id,
            "requested_time": datetime.fromisoformat(datetime.utcnow().isoformat()),
            "status": "PENDING",
            "image_tag": image_tag,
        }
        db.session.add(models.JupyterImageBuild(**jupyter_image_build))
        events.register_jupyter_image_build_created(task_id)

        self.collateral_kwargs["task_id"] = task_id
        self.collateral_kwargs["image_tag"] = str(image_tag)
        return jupyter_image_build

    def _collateral(self, task_id: str, image_tag: str):
        celery = current_app.config["CELERY"]

        celery.send_task(
            "app.core.tasks.build_jupyter_image",
            kwargs={"image_tag": image_tag},
            task_id=task_id,
        )

    def _revert(self):
        models.JupyterImageBuild.query.filter_by(
            uuid=self.collateral_kwargs["task_id"]
        ).update({"status": "FAILURE"})
        events.register_jupyter_image_build_failed(self.collateral_kwargs["task_id"])
        db.session.commit()


class AbortJupyterEnvironmentBuild(TwoPhaseFunction):
    def _transaction(self, jupyter_image_build_uuid: str):

        filter_by = {
            "uuid": jupyter_image_build_uuid,
        }
        status_update = {"status": "ABORTED"}
        # Will return true if any row is affected, meaning that the
        # jupyter build was actually PENDING or STARTED.
        abortable = update_status_db(
            status_update,
            model=models.JupyterImageBuild,
            filter_by=filter_by,
        )
        if abortable:
            events.register_jupyter_image_build_cancelled(jupyter_image_build_uuid)

        self.collateral_kwargs["jupyter_image_build_uuid"] = (
            jupyter_image_build_uuid if abortable else None
        )
        return abortable

    def _collateral(self, jupyter_image_build_uuid: Optional[str]):

        if not jupyter_image_build_uuid:
            return

        celery = current_app.config["CELERY"]
        # Make use of both constructs (revoke, abort) so we cover both a
        # task that is pending and a task which is running.
        celery.control.revoke(jupyter_image_build_uuid, timeout=1.0)
        res = AbortableAsyncResult(jupyter_image_build_uuid, app=celery)
        # It is responsibility of the task to terminate by reading it's
        # aborted status.
        res.abort()
