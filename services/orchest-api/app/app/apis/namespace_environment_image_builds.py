import uuid
from datetime import datetime
from typing import Optional

from celery.contrib.abortable import AbortableAsyncResult
from flask import abort, current_app, request
from flask_restx import Namespace, Resource
from sqlalchemy import desc, func, or_

import app.models as models
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema
from app.connections import db
from app.core import events
from app.utils import get_logger, update_status_db, upsert_cluster_node

api = Namespace("environment-builds", description="Managing environment builds")
api = schema.register_schema(api)

logger = get_logger()


@api.route("/")
class EnvironmentImageBuildList(Resource):
    @api.doc("get_environment_image_builds")
    @api.marshal_with(schema.environment_image_builds)
    def get(self):
        """Fetches all environment builds (past and present).

        The environment builds are either PENDING, STARTED, SUCCESS,
        FAILURE, ABORTED.

        """
        environment_image_builds = models.EnvironmentImageBuild.query.all()
        if not environment_image_builds:
            environment_image_builds = []

        return (
            {
                "environment_image_builds": [
                    envb.as_dict() for envb in environment_image_builds
                ]
            },
            200,
        )

    @api.doc("start_environment_image_builds")
    @api.expect(schema.environment_image_build_requests)
    @api.marshal_with(
        schema.environment_image_builds_requests_result,
        code=201,
        description="Queued environment builds",
    )
    def post(self):
        """Queues a list of environment builds.

        Only unique requests are considered, meaning that a request
        containing duplicate environment_image_build_requests will
        produce an environment build only for each unique
        environment_image_build_request. Note that requesting an
        environment_image_build for an environment (identified by
        project_uuid, environment_uuid, project_path) will REVOKE/ABORT
        any other active (queued or actually started) environment build
        for that environment.  This implies that only an environment
        build can be active (queued or actually started) for a given
        environment.
        """

        # Keep only unique requests.
        post_data = request.get_json()
        builds_requests = post_data["environment_image_build_requests"]
        builds_requests = set(
            [
                (req["project_uuid"], req["environment_uuid"], req["project_path"])
                for req in builds_requests
            ]
        )
        builds_requests = [
            {
                "project_uuid": req[0],
                "environment_uuid": req[1],
                "project_path": req[2],
            }
            for req in builds_requests
        ]

        defined_builds = []
        failed_requests = []
        # Start a celery task for each unique environment build request.
        for build_request in builds_requests:
            try:
                with TwoPhaseExecutor(db.session) as tpe:
                    defined_builds.append(
                        CreateEnvironmentImageBuild(tpe).transaction(build_request)
                    )
            except Exception:
                failed_requests.append(build_request)

        return_data = {"environment_image_builds": defined_builds}
        return_code = 200

        if failed_requests:
            return_data["failed_requests"] = failed_requests
            return_code = 500

        return return_data, return_code


@api.route(
    "/<string:project_uuid>/<string:environment_uuid>/<string:image_tag>",
)
@api.param("project_uuid")
@api.param("environment_uuid")
@api.param("image_tag")
@api.response(404, "Environment build not found")
class EnvironmentImageBuild(Resource):
    @api.doc("get_environment_image_build")
    @api.marshal_with(schema.environment_image_build, code=200)
    def get(self, project_uuid, environment_uuid, image_tag):
        """Fetch an environment build. #CLOUD."""
        env_build = models.EnvironmentImageBuild.query.filter_by(
            project_uuid=project_uuid,
            environment_uuid=environment_uuid,
            image_tag=int(image_tag),
        ).one_or_none()
        if env_build is not None:
            return env_build.as_dict()
        abort(404, "EnvironmentImageBuild not found.")

    @api.doc("set_environment_image_build_status")
    @api.expect(schema.status_update)
    def put(self, project_uuid, environment_uuid, image_tag):
        """Set the status of a environment build."""
        status_update = request.get_json()

        filter_by = {
            "project_uuid": project_uuid,
            "environment_uuid": environment_uuid,
            "image_tag": int(image_tag),
        }
        try:
            if status_update.get("cluster_node") is not None:
                upsert_cluster_node(status_update["cluster_node"])

            if not update_status_db(
                status_update,
                model=models.EnvironmentImageBuild,
                filter_by=filter_by,
            ):
                return

            if status_update["status"] == "SUCCESS":
                db.session.add(
                    models.EnvironmentImage(
                        project_uuid=project_uuid,
                        environment_uuid=environment_uuid,
                        tag=int(image_tag),
                        stored_in_registry=False,
                    )
                )
                build = models.EnvironmentImageBuild.query.filter_by(**filter_by).one()
                if build.cluster_node is None:
                    raise Exception("Build cluster_node not set.")
                db.session.add(
                    models.EnvironmentImageOnNode(
                        project_uuid=project_uuid,
                        environment_uuid=environment_uuid,
                        environment_image_tag=int(image_tag),
                        node_name=build.cluster_node,
                    )
                )
                events.register_environment_image_build_succeeded_event(
                    project_uuid, environment_uuid, int(image_tag)
                )
            elif status_update["status"] == "FAILURE":
                events.register_environment_image_build_failed_event(
                    project_uuid, environment_uuid, int(image_tag)
                )
            elif status_update["status"] == "STARTED":
                events.register_environment_image_build_started_event(
                    project_uuid, environment_uuid, int(image_tag)
                )
            db.session.commit()
        except Exception as e:
            logger.error(e)
            db.session.rollback()
            return {"message": "Failed update operation."}, 500

        return {"message": "Status was updated successfully."}, 200

    @api.doc("delete_environment_image_build")
    @api.response(200, "Environment build cancelled or stopped ")
    def delete(self, project_uuid, environment_uuid, image_tag):
        """Stops an environment build.

        However, it will not delete any corresponding database entries,
        it will update the status of corresponding objects to ABORTED.
        """
        try:
            with TwoPhaseExecutor(db.session) as tpe:
                could_abort = AbortEnvironmentImageBuild(tpe).transaction(
                    project_uuid, environment_uuid, image_tag
                )
        except Exception as e:
            return {"message": str(e)}, 500

        if could_abort:
            return {"message": "Environment build termination was successfull."}, 200
        else:
            return {
                "message": "Environment build does not exist or is not running."
            }, 400


@api.route(
    "/most-recent/<string:project_uuid>",
)
@api.param(
    "project_uuid",
    "UUID of the project for which environment builds should be collected",
)
class ProjectMostRecentBuildsList(Resource):
    @api.doc("get_project_most_recent_environment_image_builds")
    @api.marshal_with(schema.environment_image_builds, code=200)
    def get(self, project_uuid):
        """Get the most recent build for each environment of a project.

        Only environments for which builds have already been requested
        are considered.  Meaning that environments that are part of a
        project but have never been built won't be part of results.

        """

        # Filter by project uuid. Use a window function to get the most
        # recently requested build for each environment return.
        rank = (
            func.rank()
            .over(partition_by="environment_uuid", order_by=desc("requested_time"))
            .label("rank")
        )
        query = db.session.query(models.EnvironmentImageBuild)
        query = query.filter_by(project_uuid=project_uuid)
        query = query.add_column(rank)
        # Note: this works because rank is of type Label and rank == 1
        # will evaluate to sqlalchemy.sql.elements.BinaryExpression
        # since the equality operator is overloaded.
        query = query.from_self().filter(rank == 1)
        query = query.with_entities(models.EnvironmentImageBuild)
        env_builds = query.all()

        return {"environment_image_builds": [build.as_dict() for build in env_builds]}


@api.route("/most-recent/<string:project_uuid>/<string:environment_uuid>")
@api.param("project_uuid", "UUID of the project.")
@api.param("environment_uuid", "UUID of the environment.")
class ProjectEnvironmentMostRecentBuild(Resource):
    @api.doc("get_most_recent_build_by_proj_env")
    @api.marshal_with(schema.environment_image_builds, code=200)
    def get(self, project_uuid, environment_uuid):
        """Get the most recent build for a project and environment pair.

        Only environments for which builds have already been requested
        are considered.
        """

        environment_image_builds = []

        recent = (
            db.session.query(models.EnvironmentImageBuild)
            .filter_by(project_uuid=project_uuid, environment_uuid=environment_uuid)
            .order_by(desc(models.EnvironmentImageBuild.requested_time))
            .first()
        )
        if recent:
            environment_image_builds.append(recent.as_dict())

        return {"environment_image_builds": environment_image_builds}


class CreateEnvironmentImageBuild(TwoPhaseFunction):
    def _transaction(self, build_request):

        # Abort any environment build of this environment that is
        # already running, given by the status of PENDING/STARTED.
        already_running_builds = models.EnvironmentImageBuild.query.filter(
            models.EnvironmentImageBuild.project_uuid == build_request["project_uuid"],
            models.EnvironmentImageBuild.environment_uuid
            == build_request["environment_uuid"],
            models.EnvironmentImageBuild.project_path == build_request["project_path"],
            or_(
                models.EnvironmentImageBuild.status == "PENDING",
                models.EnvironmentImageBuild.status == "STARTED",
            ),
        ).all()

        for build in already_running_builds:
            AbortEnvironmentImageBuild(self.tpe).transaction(
                build.project_uuid,
                build.environment_uuid,
                build.image_tag,
            )

        # We specify the task id beforehand so that we can commit to the
        # db before actually launching the task, since the task might
        # make some calls to the orchest-api referring to itself (e.g.
        # a status update), and thus expecting to find itself in the db.
        # This way we avoid race conditions.
        task_id = str(uuid.uuid4())

        # TODO: verify if forget has the same effect of
        # ignore_result=True because ignore_result cannot be used with
        # abortable tasks.
        # https://stackoverflow.com/questions/9034091/how-to-check-task-status-in-celery
        # task.forget()
        (
            models.Environment.query.with_for_update()
            .filter_by(
                project_uuid=build_request["project_uuid"],
                uuid=build_request["environment_uuid"],
            )
            .one()
        )
        latest_environment_img_build = (
            models.EnvironmentImageBuild.query.filter_by(
                project_uuid=build_request["project_uuid"],
                environment_uuid=build_request["environment_uuid"],
            )
            .order_by(desc(models.EnvironmentImageBuild.image_tag))
            .first()
        )
        if latest_environment_img_build is None:
            image_tag = 1
        else:
            image_tag = latest_environment_img_build.image_tag + 1

        environment_image_build = {
            "celery_task_uuid": task_id,
            "project_uuid": build_request["project_uuid"],
            "environment_uuid": build_request["environment_uuid"],
            "image_tag": image_tag,
            "project_path": build_request["project_path"],
            "requested_time": datetime.fromisoformat(datetime.utcnow().isoformat()),
            "status": "PENDING",
        }
        db.session.add(models.EnvironmentImageBuild(**environment_image_build))

        events.register_environment_image_build_created_event(
            build_request["project_uuid"], build_request["environment_uuid"], image_tag
        )

        self.collateral_kwargs["task_id"] = task_id
        self.collateral_kwargs["project_uuid"] = build_request["project_uuid"]
        self.collateral_kwargs["environment_uuid"] = build_request["environment_uuid"]
        self.collateral_kwargs["image_tag"] = str(image_tag)
        self.collateral_kwargs["project_path"] = build_request["project_path"]
        return environment_image_build

    def _collateral(
        self,
        task_id: str,
        project_uuid: str,
        environment_uuid: str,
        image_tag: str,
        project_path: str,
    ):
        celery = current_app.config["CELERY"]
        celery_job_kwargs = {
            "project_uuid": project_uuid,
            "environment_uuid": environment_uuid,
            "image_tag": image_tag,
            "project_path": project_path,
        }

        celery.send_task(
            "app.core.tasks.build_environment_image",
            kwargs=celery_job_kwargs,
            task_id=task_id,
        )

    def _revert(self):
        models.EnvironmentImageBuild.query.filter_by(
            uuid=self.collateral_kwargs["task_id"]
        ).update({"status": "FAILURE"})
        events.register_environment_image_build_failed_event(
            self.collateral_kwargs["project_uuid"],
            self.collateral_kwargs["environment_uuid"],
            int(self.collateral_kwargs["image_tag"]),
        )
        db.session.commit()


class AbortEnvironmentImageBuild(TwoPhaseFunction):
    def _transaction(self, project_uuid: str, environment_uuid: str, image_tag: str):

        filter_by = {
            "project_uuid": project_uuid,
            "environment_uuid": environment_uuid,
            "image_tag": int(image_tag),
        }
        status_update = {"status": "ABORTED"}
        # Will return true if any row is affected, meaning that the
        # environment build was actually PENDING or STARTED.
        abortable = update_status_db(
            status_update,
            model=models.EnvironmentImageBuild,
            filter_by=filter_by,
        )

        self.collateral_kwargs["celery_task_uuid"] = None
        if abortable:
            env_build = models.EnvironmentImageBuild.query.filter_by(**filter_by).one()
            self.collateral_kwargs["celery_task_uuid"] = env_build.celery_task_uuid

            events.register_environment_image_build_cancelled_event(
                project_uuid, environment_uuid, int(image_tag)
            )
        return abortable

    def _collateral(self, celery_task_uuid: Optional[str]):

        if not celery_task_uuid:
            return

        celery = current_app.config["CELERY"]
        # Make use of both constructs (revoke, abort) so we cover both a
        # task that is pending and a task which is running.
        celery.control.revoke(celery_task_uuid, timeout=1.0)
        res = AbortableAsyncResult(celery_task_uuid, app=celery)
        # It is responsibility of the task to terminate by reading it's
        # aborted status.
        res.abort()


class DeleteProjectEnvironmentImageBuilds(TwoPhaseFunction):
    def _transaction(self, project_uuid: str, environment_uuid: str):
        # Order by request time so that the first build might be related
        # be related to a PENDING or STARTED build, all others are
        # surely not PENDING or STARTED.
        env_builds = (
            models.EnvironmentImageBuild.query.filter_by(
                project_uuid=project_uuid, environment_uuid=environment_uuid
            )
            .order_by(desc(models.EnvironmentImageBuild.requested_time))
            .all()
        )

        if len(env_builds) > 0 and env_builds[0].status in ["PENDING", "STARTED"]:
            AbortEnvironmentImageBuild(self.tpe).transaction(
                env_builds[0].project_uuid,
                env_builds[0].environment_uuid,
                env_builds[0].image_tag,
            )

        for build in env_builds:
            db.session.delete(build)

    def _collateral(self):
        pass


class DeleteProjectBuilds(TwoPhaseFunction):
    def _transaction(self, project_uuid: str):
        builds = (
            models.EnvironmentImageBuild.query.filter_by(project_uuid=project_uuid)
            .with_entities(
                models.EnvironmentImageBuild.project_uuid,
                models.EnvironmentImageBuild.environment_uuid,
            )
            .distinct()
            .all()
        )

        for build in builds:
            DeleteProjectEnvironmentImageBuilds(self.tpe).transaction(
                build.project_uuid, build.environment_uuid
            )

    def _collateral(self):
        pass
