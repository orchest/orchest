from typing import List

from flask import abort, request
from flask.globals import current_app
from flask_restx import Namespace, Resource
from sqlalchemy import desc, func

from _orchest.internals import config as _config
from _orchest.internals.two_phase_executor import TwoPhaseFunction
from app import models, schema, utils
from app.apis.namespace_environment_image_builds import DeleteProjectBuilds
from app.connections import db
from app.core import environments, image_utils, scheduler

api = Namespace("environment-images", description="Managing environment images")
api = schema.register_schema(api)

logger = utils.get_logger()


@api.route("/latest/<string:project_uuid>/<string:environment_uuid>")
@api.param("project_uuid", "uuid of the project")
@api.param("environment_uuid", "uuid of the environment")
class LatestProjectEnvironmentEnvironmentImage(Resource):
    @api.doc("get_latest_project_environment_environment_image")
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


@api.route("/<string:project_uuid>/<string:environment_uuid>/<string:tag>/registry")
@api.param("project_uuid", "uuid of the project")
@api.param("environment_uuid", "uuid of the environment")
@api.param("tag", "Tag of the image")
class EnvironmentImageRegistryStatus(Resource):
    @api.doc("put_environment_image_push_status")
    def put(self, project_uuid, environment_uuid, tag):
        """Notifies that the image has been pushed to the registry."""
        image = models.EnvironmentImage.query.get_or_404(
            ident=(project_uuid, environment_uuid, int(tag)),
            description="Environment image not found.",
        )
        image.stored_in_registry = True
        db.session.commit()
        return {}, 200


@api.route(
    "/<string:project_uuid>/<string:environment_uuid>/<string:tag>/node/<string:node>"
)
@api.param("project_uuid", "uuid of the project")
@api.param("environment_uuid", "uuid of the environment")
@api.param("tag", "Tag of the image")
@api.param("node", "Node on which the image was pulled")
class EnvironmentImageNodeStatus(Resource):
    @api.doc("put_environment_image_node_state")
    def put(self, project_uuid, environment_uuid, tag, node):
        """Notifies that the image has been pulled to a node."""

        models.EnvironmentImage.query.get_or_404(
            ident=(project_uuid, environment_uuid, int(tag)),
            description="Environment image not found.",
        )
        utils.upsert_environment_image_on_node(
            project_uuid, environment_uuid, tag, node
        )
        db.session.commit()
        return {}, 200


@api.route("/latest")
class LatestEnvironmentImage(Resource):
    @api.doc("get_latest_environment_image")
    @api.marshal_with(schema.environment_images, code=200)
    def get(self):
        """Fetches the latest built images for all environments."""
        latest_env_images = db.session.query(
            models.EnvironmentImage.project_uuid,
            models.EnvironmentImage.environment_uuid,
            func.max(models.EnvironmentImage.tag).label("tag"),
        ).group_by(
            models.EnvironmentImage.project_uuid,
            models.EnvironmentImage.environment_uuid,
        )
        latest_env_images = [a for a in latest_env_images]
        return {"environment_images": latest_env_images}, 200


def _get_formatted_active_environment_imgs(
    stored_in_registry=None, in_node=None, not_in_node=None
) -> List[str]:
    active_env_images = environments.get_active_environment_images(
        stored_in_registry=stored_in_registry, in_node=in_node, not_in_node=not_in_node
    )

    active_env_images_names = []
    registry_ip = utils.get_registry_ip()
    for img in active_env_images:
        image = (
            _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=img.project_uuid, environment_uuid=img.environment_uuid
            )
            + ":"
            + str(img.tag)
        )
        active_env_images_names.append(f"{registry_ip}/{image}")
    return active_env_images_names


@api.route("/active")
@api.param("stored_in_registry")
@api.param("in_node")
@api.param("not_in_node")
class ActiveEnvironmentImages(Resource):
    @api.doc("get_active_environment_images")
    @api.marshal_with(schema.active_environment_images, code=200)
    def get(self):
        """Gets the list of environment images to keep on nodes."""

        active_env_images = _get_formatted_active_environment_imgs(
            stored_in_registry=request.args.get(
                "stored_in_registry", default=None, type=lambda v: v in ["True", "true"]
            ),
            in_node=request.args.get("in_node"),
            not_in_node=request.args.get("not_in_node"),
        )

        return {"active_environment_images": active_env_images}, 200


@api.route("/to-push")
@api.param("in_node")
class ActiveEnvironmentImagesToPush(Resource):
    @api.doc("get_environment_images_to_push")
    @api.marshal_with(schema.active_environment_images, code=200)
    def get(self):
        """To be used by the image-pusher to get images to push.

        #CLOUD
        """

        active_env_images = _get_formatted_active_environment_imgs(
            stored_in_registry=False,
            in_node=request.args.get("in_node"),
        )

        # This to avoid image pushes running concurrently with a
        # registry GC, we avoid the race condition by having the
        # PROCESS_IMAGE_DELETION task status be updated and then having
        # the task quit if an image build is ongoing or if an image
        # needs to be pushed. By doing so, together with this check,
        # makes it so that no concurrent pushes and GCs are going to
        # run. Also, this call Should be after the images are fetched to
        # avoid a - very improbable - race condition.
        if scheduler.is_running(scheduler.SchedulerJobType.PROCESS_IMAGES_FOR_DELETION):
            active_env_images = []

        return {"active_environment_images": active_env_images}, 200


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
