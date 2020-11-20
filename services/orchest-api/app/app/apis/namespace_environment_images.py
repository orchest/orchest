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
        or experiment which are pending or running."""

        # look only through runs belonging to the project
        # consider only docker ids related to the environment_uuid
        filters = {
            "label": [
                f"_orchest_project_uuid={project_uuid}",
                f"_orchest_environment_uuid={environment_uuid}",
            ]
        }

        project_env_images = docker_client.images.list(filters=filters)

        for docker_img in project_env_images:
            remove_if_dangling(docker_img)

        return {"message": "Successfully removed dangling images"}, 200
