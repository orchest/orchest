from docker import errors
from flask_restplus import Namespace, Resource
import logging

from app.connections import docker_client
import app.models as models
from app.utils import register_schema
from app.utils import remove_if_dangling
from app.utils import experiments_using_environment
from app.utils import interactive_runs_using_environment
from app.utils import is_environment_in_use
from app.apis.namespace_experiments import stop_experiment
from app.apis.namespace_environment_builds import delete_project_environment_builds
from app.apis.namespace_environment_builds import delete_project_builds
from app.apis.namespace_runs import stop_pipeline_run
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
        """Removes an environment image given project_uuid and image_uuid

        Will stop any run or experiment making use of this environment.
        """
        image_name = _config.ENVIRONMENT_IMAGE_NAME.format(
            project_uuid=project_uuid, environment_uuid=environment_uuid
        )

        # stop all interactive runs making use of the environment
        int_runs = interactive_runs_using_environment(project_uuid, environment_uuid)
        for run in int_runs:
            stop_pipeline_run(run.run_uuid)

        # stop all experiments making use of the environment
        exps = experiments_using_environment(project_uuid, environment_uuid)
        for exp in exps:
            stop_experiment(exp.experiment_uuid)

        # cleanup references to the builds and dangling images
        # of this environment
        delete_project_environment_builds(project_uuid, environment_uuid)
        delete_project_environment_dangling_images(project_uuid, environment_uuid)

        try:
            docker_client.images.remove(image_name)
        except errors.ImageNotFound:
            return {"message": f"Environment image {image_name} not found"}, 404
        except Exception as e:
            return (
                {
                    "message": f"There was an error deleting the image {image_name}.\n{e}"
                },
                500,
            )

        return (
            {"message": f"Environment image {image_name} was successfully deleted"},
            200,
        )


@api.route(
    "/in_use/<string:project_uuid>/<string:environment_uuid>",
)
@api.param("project_uuid", "UUID of the project")
@api.param("environment_uuid", "UUID of the environment")
class EnvironmentImageInUse(Resource):
    @api.doc("is-environment-in-use")
    def get(self, project_uuid, environment_uuid):
        in_use = is_environment_in_use(project_uuid, environment_uuid)
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
        or experiment which are pending or running."""

        delete_project_environment_dangling_images(project_uuid, environment_uuid)
        return {"message": "Successfully removed dangling images"}, 200


def delete_project_environment_images(project_uuid):
    """Delete environment images of a project.

    All environment images related to the project are removed
    from the environment, running environment builds are stopped
    and removed from the db. Dangling docker images are also removed.

    Args:
        project_uuid:
    """

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

    # cleanup references to the builds and dangling images
    # of all environments of this project
    delete_project_builds(project_uuid)
    delete_project_dangling_images(project_uuid)

    image_remove_exceptions = []
    for image_name in image_names_to_remove:
        try:
            docker_client.images.remove(image_name)
        except Exception as e:
            image_remove_exceptions.append(
                f"There was an error deleting the image {image_name}:\n{e}"
            )

    if len(image_remove_exceptions) > 0:
        image_remove_exceptions = "\n".join(image_remove_exceptions)
        logging.warning(image_remove_exceptions)


def delete_project_dangling_images(project_uuid):
    """Removes dangling images related to a project.

    Dangling images are images that have been left nameless and
    tag-less and which are not referenced by any run
    or experiment which are pending or running.

    Args:
        project_uuid:
    """
    # look only through runs belonging to the project
    filters = {
        "label": [
            f"_orchest_env_build_is_intermediate=0",
            f"_orchest_project_uuid={project_uuid}",
        ]
    }

    project_images = docker_client.images.list(filters=filters)

    for docker_img in project_images:
        remove_if_dangling(docker_img)


def delete_project_environment_dangling_images(project_uuid, environment_uuid):
    """Removes dangling images related to an environment.

    Dangling images are images that have been left nameless and
    tag-less and which are not referenced by any run
    or experiment which are pending or running.

    Args:
        project_uuid:
        environment_uuid:
    """
    # look only through runs belonging to the project
    # consider only docker ids related to the environment_uuid
    filters = {
        "label": [
            f"_orchest_env_build_is_intermediate=0",
            f"_orchest_project_uuid={project_uuid}",
            f"_orchest_environment_uuid={environment_uuid}",
        ]
    }

    project_env_images = docker_client.images.list(filters=filters)

    for docker_img in project_env_images:
        remove_if_dangling(docker_img)
