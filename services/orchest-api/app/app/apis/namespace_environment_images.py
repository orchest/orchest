from docker import errors
from flask_restplus import Namespace, Resource

from app.connections import docker_client
from app.utils import register_schema
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
        """Removes all environment images a project."""

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

        try:
            for image_name in image_names_to_remove:
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
            {
                "message": f"Project {project_uuid} environment images were successfully deleted"
            },
            200,
        )
