"""API endpoint to manage environments."""
from flask import abort, current_app, request
from flask_restx import Namespace, Resource

import app.models as models
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema
from app.apis.namespace_environment_image_builds import (
    DeleteProjectEnvironmentImageBuilds,
)
from app.apis.namespace_jobs import AbortJob
from app.apis.namespace_runs import AbortPipelineRun
from app.apis.namespace_sessions import StopInteractiveSession
from app.connections import db
from app.core import environments, events

api = Namespace("environments", description="Managing Environments")
api = schema.register_schema(api)


@api.route("/")
class EnvironmentList(Resource):
    @api.doc("get_environments")
    @api.marshal_with(schema.environments)
    def get(self):
        """Get all environments."""

        environments = models.Environment.query.all()
        return {"environments": [env.__dict__ for env in environments]}, 200


@api.route("/<string:project_uuid>")
@api.param("project_uuid", "uuid of the project")
class ProjectEnvironmentList(Resource):
    @api.doc("get_project_environments")
    @api.marshal_with(schema.environments)
    def get(self, project_uuid):
        """Get all environments of a project."""

        environments = models.Environment.query.filter_by(
            project_uuid=project_uuid
        ).all()
        return {"environments": [env.__dict__ for env in environments]}, 200

    @api.doc("create_project_environment")
    @api.expect(schema.environment_post)
    @api.marshal_with(schema.environment)
    def post(self, project_uuid):
        """Create a new environment for a project."""
        environment = request.get_json()
        environment["project_uuid"] = project_uuid
        try:
            env = models.Environment(**environment)
            db.session.add(env)
            events.register_environment_created_event(project_uuid, environment["uuid"])
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(e)
            return {"message": "Environment creation failed."}, 500
        return env, 201


@api.route("/<string:project_uuid>/<string:environment_uuid>")
@api.param("project_uuid", "uuid of the project")
@api.param("environment_uuid", "uuid of the environment")
class Environment(Resource):
    @api.doc("get_environment")
    @api.marshal_with(schema.environment, code=200)
    def get(self, project_uuid, environment_uuid):
        """Fetches an environment given its project and env uuid."""
        environment = models.Environment.query.filter_by(
            project_uuid=project_uuid, uuid=environment_uuid
        ).one_or_none()
        if environment is None:
            abort(404, "Environment not found.")
        return environment

    @api.doc("delete_environment")
    @api.response(200, "Environment deleted")
    def delete(self, project_uuid, environment_uuid):
        """Delete an environment.

        Any session, run, job or environment build related to the
        environment will be aborted, environment images will be removed.
        """
        try:
            with TwoPhaseExecutor(db.session) as tpe:
                DeleteEnvironment(tpe).transaction(project_uuid, environment_uuid)

        except Exception as e:
            return {"message": str(e)}, 500

        return {"message": "Environment deletion was successful."}, 200


@api.route(
    "/in-use/<string:project_uuid>/<string:environment_uuid>",
)
@api.param("project_uuid", "UUID of the project")
@api.param("environment_uuid", "UUID of the environment")
class EnvironmentInUse(Resource):
    @api.doc("is-environment-in-use")
    def get(self, project_uuid, environment_uuid):
        in_use = environments.is_environment_in_use(project_uuid, environment_uuid)
        return {"in_use": in_use}, 200


class DeleteEnvironment(TwoPhaseFunction):
    """Delete an environment and all related entities.

    Project sessions, runs, jobs and environment builds are stopped.
    Every related entity in the db is removed. Environment images are
    deleted.
    """

    def _transaction(self, project_uuid: str, environment_uuid: str):
        # Stop all interactive sessions making use of the env by using
        # it as a service.
        int_sess = environments.interactive_sessions_using_environment(
            project_uuid, environment_uuid
        )
        for sess in int_sess:
            StopInteractiveSession(self.tpe).transaction(
                sess.project_uuid, sess.pipeline_uuid, async_mode=True
            )

        # Stop all interactive runs making use of the env.
        int_runs = environments.interactive_runs_using_environment(
            project_uuid, environment_uuid
        )
        for run in int_runs:
            AbortPipelineRun(self.tpe).transaction(run.uuid)

        # Stop all jobs making use of the environment.
        jobs = environments.jobs_using_environment(project_uuid, environment_uuid)
        for job in jobs:
            AbortJob(self.tpe).transaction(job.uuid)

        # Mark images to be removed from nodes and registry.
        environments.mark_all_proj_env_images_to_be_removed_on_env_deletion(
            project_uuid=project_uuid,
            environment_uuid=environment_uuid,
        )

        # Cleanup references to the builds and dangling images of this
        # environment.
        DeleteProjectEnvironmentImageBuilds(self.tpe).transaction(
            project_uuid, environment_uuid
        )

        self.collateral_kwargs["project_uuid"] = project_uuid
        self.collateral_kwargs["environment_uuid"] = environment_uuid

        events.register_environment_deleted_event(project_uuid, environment_uuid)
        models.Environment.query.filter_by(
            project_uuid=project_uuid, uuid=environment_uuid
        ).delete()

    @classmethod
    def _background_collateral(cls, app, project_uuid, environment_uuid):
        pass

    def _collateral(self, project_uuid: str, environment_uuid: str):
        # Needs to happen in the background because session shutdown
        # happens in the background as well. The scheduler won't be
        # given control if an endpoint is, for example, sleeping.
        current_app.config["SCHEDULER"].add_job(
            DeleteEnvironment._background_collateral,
            args=[current_app._get_current_object(), project_uuid, environment_uuid],
        )
