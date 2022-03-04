from flask.globals import current_app
from flask_restx import Namespace, Resource

from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import models
from app.apis.namespace_environment_builds import (
    AbortEnvironmentBuild,
    DeleteProjectBuilds,
    DeleteProjectEnvironmentBuilds,
)
from app.apis.namespace_jobs import AbortJob
from app.apis.namespace_jupyter_builds import AbortJupyterBuild
from app.apis.namespace_runs import AbortPipelineRun
from app.apis.namespace_sessions import StopInteractiveSession
from app.connections import db
from app.core import environments, image_utils
from app.utils import register_schema

api = Namespace("environment-images", description="Managing environment images")
api = register_schema(api)


@api.route(
    "/<string:project_uuid>/<string:environment_uuid>",
)
@api.param("project_uuid", "UUID of the project")
@api.param("environment_uuid", "UUID of the environment")
class EnvironmentImage(Resource):
    @api.doc("delete-environment-image")
    def delete(self, project_uuid, environment_uuid):
        """Removes an environment image given project and env uuids.

        Will stop any run or job making use of this environment.
        """
        try:
            with TwoPhaseExecutor(db.session) as tpe:
                DeleteImage(tpe).transaction(project_uuid, environment_uuid)

        except Exception as e:
            return {"message": str(e)}, 500

        return {"message": "Environment image was successfully deleted."}, 200


@api.route(
    "/base-images-cache",
)
class BaseImagesCache(Resource):
    @api.doc("delete-base-images-cache")
    def delete(self):
        """Deletes the base images cache.

        All ongoing environment and/or jupyter builds are cancelled.
        """
        try:
            with TwoPhaseExecutor(db.session) as tpe:
                DeleteBaseImagesCache(tpe).transaction()
        except Exception as e:
            return {"message": str(e)}, 500

        return {"message": "Base images cache deletion successful."}, 200


@api.route(
    "/in-use/<string:project_uuid>/<string:environment_uuid>",
)
@api.param("project_uuid", "UUID of the project")
@api.param("environment_uuid", "UUID of the environment")
class EnvironmentImageInUse(Resource):
    @api.doc("is-environment-in-use")
    def get(self, project_uuid, environment_uuid):
        in_use = environments.is_environment_in_use(project_uuid, environment_uuid)
        return {"message": in_use, "in_use": in_use}, 200


@api.route(
    "/dangling/<string:project_uuid>/<string:environment_uuid>",
)
@api.param("project_uuid", "UUID of the project")
@api.param("environment_uuid", "UUID of the environment")
class ProjectEnvironmentDanglingImages(Resource):
    @api.doc("delete-project-environment-dangling-images")
    def delete(self, project_uuid, environment_uuid):
        """Removes dangling images related to a project and environment.
        Dangling images are images that have been left nameless and
        tag-less and which are not referenced by any run
        or job which are pending or running."""

        return {"message": "Successfully removed dangling images."}, 200


class DeleteProjectEnvironmentImages(TwoPhaseFunction):
    def _transaction(self, project_uuid: str):
        # Cleanup references to the builds and dangling images of all
        # environments of this project.
        DeleteProjectBuilds(self.tpe).transaction(project_uuid)

        self.collateral_kwargs["project_uuid"] = project_uuid

    @classmethod
    def _background_collateral(cls, app, project_uuid):
        with app.app_context():
            image_utils.delete_project_dangling_images(project_uuid)

    def _collateral(self, project_uuid: str):
        # Needs to happen in the background because session shutdown
        # happens in the background as well. The scheduler won't be
        # given control if an endpoint is, for example, sleeping.
        current_app.config["SCHEDULER"].add_job(
            DeleteProjectEnvironmentImages._background_collateral,
            args=[current_app._get_current_object(), project_uuid],
        )


class DeleteImage(TwoPhaseFunction):
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

        # Cleanup references to the builds and dangling images
        # of this environment.
        DeleteProjectEnvironmentBuilds(self.tpe).transaction(
            project_uuid, environment_uuid
        )

        self.collateral_kwargs["project_uuid"] = project_uuid
        self.collateral_kwargs["environment_uuid"] = environment_uuid

    @classmethod
    def _background_collateral(cls, app, project_uuid, environment_uuid):
        pass

    def _collateral(self, project_uuid: str, environment_uuid: str):
        # Needs to happen in the background because session shutdown
        # happens in the background as well. The scheduler won't be
        # given control if an endpoint is, for example, sleeping.
        current_app.config["SCHEDULER"].add_job(
            DeleteImage._background_collateral,
            args=[current_app._get_current_object(), project_uuid, environment_uuid],
        )


class DeleteBaseImagesCache(TwoPhaseFunction):
    def _transaction(self):
        env_builds = models.EnvironmentImageBuild.query.filter(
            models.EnvironmentImageBuild.status.in_(["PENDING", "STARTED"])
        )
        for eb in env_builds:
            AbortEnvironmentBuild(self.tpe).transaction(eb.uuid)
        jupyter_builds = models.JupyterBuild.query.filter(
            models.JupyterBuild.status.in_(["PENDING", "STARTED"])
        )
        for jb in jupyter_builds:
            AbortJupyterBuild(self.tpe).transaction(jb.uuid)

    def _collateral(self):
        image_utils.delete_base_images_cache()
