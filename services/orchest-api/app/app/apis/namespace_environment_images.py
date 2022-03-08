from flask import abort
from flask.globals import current_app
from flask_restx import Namespace, Resource
from sqlalchemy import desc

from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import models, schema
from app.apis.namespace_environment_image_builds import (
    AbortEnvironmentImageBuild,
    DeleteProjectBuilds,
)
from app.apis.namespace_jupyter_image_builds import AbortJupyterEnvironmentBuild
from app.connections import db
from app.core import image_utils
from app.utils import register_schema

api = Namespace("environment-images", description="Managing environment images")
api = register_schema(api)


@api.route("/<string:project_uuid>/<string:environment_uuid>/latest")
@api.param("project_uuid", "uuid of the project")
@api.param("environment_uuid", "uuid of the environment")
class LatestEnvironmentImage(Resource):
    @api.doc("get_latest_environment_image")
    @api.marshal_with(schema.environment_image, code=200)
    def get(self, project_uuid, environment_uuid):
        """Fetches the latest built image for an environment."""
        env_image = (
            models.EnvironmentImage.query.filter_by(
                project_uuid=project_uuid,
                environment_uuid=environment_uuid,
            )
            .order_by(desc(models.EnvironmentImage.tag))
            .first()
        )
        if env_image is None:
            abort(404, "No image for for this environment.")
        return env_image


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


class DeleteBaseImagesCache(TwoPhaseFunction):
    def _transaction(self):
        env_builds = models.EnvironmentImageBuild.query.filter(
            models.EnvironmentImageBuild.status.in_(["PENDING", "STARTED"])
        )
        for build in env_builds:
            AbortEnvironmentImageBuild(self.tpe).transaction(
                build.project_uuid,
                build.environment_uuid,
                build.image_tag,
            )
        jupyter_image_builds = models.JupyterImageBuild.query.filter(
            models.JupyterImageBuild.status.in_(["PENDING", "STARTED"])
        )
        for jb in jupyter_image_builds:
            AbortJupyterEnvironmentBuild(self.tpe).transaction(jb.uuid)

    def _collateral(self):
        image_utils.delete_base_images_cache()
