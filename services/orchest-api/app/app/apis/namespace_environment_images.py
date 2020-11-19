from docker import errors
from flask import abort
from flask_restplus import Namespace, Resource

from app.connections import docker_client
import app.models as models
from app.utils import register_schema, remove_if_dangling
from _orchest.internals import config as _config

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
        """Removes an environment image given project_uuid and image_uuid"""

        image_name = _config.ENVIRONMENT_IMAGE_NAME.format(
            project_uuid=project_uuid, environment_uuid=environment_uuid
        )

        try:
            # using force true will actually remove the image instead of simply untagging it
            docker_client.images.remove(image_name, force=True)
        except errors.ImageNotFound:
            return {"message": f"Environment image {image_name} not found"}, 404
        except Exception as e:
            return (
                {"message": f"There was an error deleting the image {image_name}."},
                500,
            )

        return (
            {"message": f"Environment image {image_name} was successfully deleted"},
            200,
        )


@api.route(
    "/<string:project_uuid>",
)
@api.param("project_uuid", "UUID of the project")
class ProjectEnvironmentImages(Resource):
    @api.doc("delete-project_environment-images")
    def delete(self, project_uuid):
        """Removes all environment images of a project."""

        # use environment_uuid="" because we are looking for all of them
        image_name = _config.ENVIRONMENT_IMAGE_NAME.format(
            project_uuid=project_uuid, environment_uuid=""
        )

        image_names_to_remove = [
            img.attrs["RepoTags"][0]
            for img in docker_client.images.list()
            if img.attrs["RepoTags"]
            and isinstance(img.attrs["RepoTags"][0], str)
            and img.attrs["RepoTags"][0].startswith(image_name)
        ]

        image_remove_exceptions = []
        for image_name in image_names_to_remove:
            try:
                # using force true will actually remove the image instead of simply untagging it
                docker_client.images.remove(image_name, force=True)
            except Exception as e:
                image_remove_exceptions.append(
                    f"There was an error deleting the image {image_name}:\n{e}"
                )

        if len(image_remove_exceptions) > 0:
            image_remove_exceptions = "\n".join(image_remove_exceptions)
            return (
                {
                    "message": f"There were errors in deleting the images of project {project_uuid}:\n{image_remove_exceptions}"
                },
                500,
            )

        return (
            {
                "message": f"Project {project_uuid} environment images were successfully deleted"
            },
            200,
        )


# currently unused, might be used later to delete dangling images when deleting an environment
@api.route(
    "/dangling/<string:project_uuid>/<string:environment_uuid>",
)
@api.param("project_uuid", "UUID of the project")
@api.param("environment_uuid", "UUID of the environment")
class ProjectEnvironmentDanglingImages(Resource):
    @api.doc("delete-project-environment-dangling-images")
    def delete(self, project_uuid, environment_uuid):
        """Removes dangling images related to a project and environment.
        Dangling images are images that have been left nameless and tagless and which are not referenced by any run
        or experiment which are pending or running."""

        # look only through runs belonging to the project
        # consider only docker ids related to the environment_uuid
        run_img_docker_ids = [
            *models.NonInteractiveRun()
            .query.filter_by(project_uuid=project_uuid)
            .join(models.NonInteractiveRunImageMapping)
            .filter_by(orchest_environment_uuid=environment_uuid)
            .with_entities(models.NonInteractiveRunImageMapping.docker_img_id)
            .distinct()
            .all(),
            *models.InteractiveRun()
            .query.filter_by(project_uuid=project_uuid)
            .join(models.InteractiveRunImageMapping)
            .filter_by(orchest_environment_uuid=environment_uuid)
            .with_entities(models.InteractiveRunImageMapping.docker_img_id)
            .distinct()
            .all(),
        ]
        run_img_docker_ids = [result[0] for result in run_img_docker_ids]

        for img_docker_id in run_img_docker_ids:
            remove_if_dangling(img_docker_id)

        return {"message": "Successfully removed dangling images"}, 200


# currently unused, might be used later to delete dangling images when deleting a project
@api.route(
    "/dangling/<string:project_uuid>",
)
@api.param("project_uuid", "UUID of the project")
class ProjectDanglingImages(Resource):
    @api.doc("delete-project-dangling-images")
    def delete(self, project_uuid):
        """Removes dangling images related to a project.
        Dangling images are images that have been left nameless and tagless and which are not referenced by any run
        or experiment which are pending or running."""

        # look only through runs belonging to the project
        # consider only docker ids related to the environment_uuid
        run_img_docker_ids = [
            *models.NonInteractiveRun()
            .query.filter_by(project_uuid=project_uuid)
            .join(models.NonInteractiveRunImageMapping)
            .with_entities(models.NonInteractiveRunImageMapping.docker_img_id)
            .distinct()
            .all(),
            *models.InteractiveRun()
            .query.filter_by(project_uuid=project_uuid)
            .join(models.InteractiveRunImageMapping)
            .with_entities(models.InteractiveRunImageMapping.docker_img_id)
            .distinct()
            .all(),
        ]
        run_img_docker_ids = [result[0] for result in run_img_docker_ids]

        for img_docker_id in run_img_docker_ids:
            remove_if_dangling(img_docker_id)

        return {"message": "Successfully removed dangling images"}, 200


@api.route(
    "/dangling/docker/<string:docker_img_id>",
)
@api.param("docker_img_id", "Docker ID of the image to be deleted if it's dangling")
class DanglingImages(Resource):
    @api.doc("delete-dangling-image")
    def delete(self, docker_img_id):
        """Removes an image if its dangling.
        Dangling images are images that have been left nameless and tagless and which are not referenced by any run
        or experiment which are pending or running."""

        if remove_if_dangling(docker_img_id):
            return {"message": "Successfully removed dangling images"}, 200
        else:
            return {"message": "Not a dangling image"}, 500
