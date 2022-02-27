"""Module to manage the lifecycle of Orchest.

TODO:
    * Improve the start/stop so that containers are not removed. Instead
      containers can just be restarted (preserving their logs). Update
      should then remove old containers to make sure the updated ones
      are used.
    * In Python3.9 PEP585 will be introduced, deprecating certain typing
      functionality. See: https://www.python.org/dev/peps/pep-0585/

"""
import json
import logging
import os
import re
import time
from functools import reduce
from typing import List, Optional, Set, Tuple

import typer

from app import config, utils

logger = logging.getLogger(__name__)


class OrchestApp:
    """..."""

    def __init__(self):
        # self.resource_manager = OrchestResourceManager()
        # self.docker_client = DockerWrapper()
        ...

    def update(self, mode=None, dev: bool = False):
        """Update Orchest.

        Args:
            mode: The mode in which to update Orchest. This is either
                ``None`` or ``"web"``, where the latter is used when
                update is invoked through the update-server.

        """
        utils.echo("Updating...")

        _, running_containers = self.resource_manager.get_containers(state="running")

        if utils.is_orchest_running(running_containers):
            if mode != "web":
                # In the web updater it is not possible to cancel the
                # update once started. So there is no value in showing
                # this message or sleeping.
                utils.echo(
                    "Using Orchest whilst updating is NOT supported and will be shut"
                    " down, killing all active pipeline runs and session. You have 2s"
                    " to cancel the update operation."
                )

                # Give the user the option to cancel the update
                # operation using a keyboard interrupt.
                time.sleep(2)

            skip_containers = []
            if mode == "web":
                # It is possible to pull new images whilst the older
                # versions of those images are running. We will invoke
                # Orchest restart from the webserver ui-updater.
                skip_containers = [
                    "orchest/update-server:latest",
                    "orchest/auth-server:latest",
                    "orchest/nginx-proxy:latest",
                    "postgres:13.1",
                ]

            self.stop(skip_containers=skip_containers)

        # Update the Orchest git repo to get the latest changes to the
        # "userdir/" structure.
        if not dev:
            exit_code = utils.update_git_repo(verbose=False)
            if exit_code == 0:
                logger.info("Successfully updated git repo during update.")
            elif exit_code == 21:
                utils.echo("Cancelling update...")
                utils.echo(
                    "Make sure you have the master branch checked out before updating."
                )
                logger.error(
                    "Failed update due to master branch not being checked out."
                )
                raise typer.Exit(code=1)
            else:
                utils.echo("Cancelling update...")
                utils.echo(
                    "It seems like you have unstaged changes in the 'orchest'"
                    " repository. Please commit or stash them as 'orchest update'"
                    " pulls the newest changes to the 'userdir/' using a rebase.",
                )
                logger.error("Failed update due to unstaged changes.")
                raise typer.Exit(code=1)

        # Get all installed images and pull new versions. The pulled
        # images are checked to make sure optional images, e.g. lang
        # specific images, are updated as well.
        pulled_images = self.resource_manager.get_images()
        to_pull_images = set(config.ORCHEST_IMAGES["minimal"]) | set(pulled_images)
        logger.info("Updating images:\n" + "\n".join(to_pull_images))
        self.docker_client.pull_images(
            to_pull_images,
            prog_bar=True,
            mode=mode,
            force=True,
        )

        # Add a tag to user environment images to mark them for removal.
        # The orchest-api will deal with the rest of the logic related
        # to making environment images unavailable to users on update
        # to avoid the issue of having environments with mismatching
        # Orchest SDK versions.
        logger.info("Tagging user-built environment images for removal.")
        self.resource_manager.tag_environment_images_for_removal()

        # Delete user-built Jupyter image to make sure the Jupyter
        # server is updated to the latest version of Orchest.
        logger.info("Deleting user-built Jupyter image.")
        self.resource_manager.remove_jupyter_build_imgs()

        if mode != "web":
            utils.echo(
                "Checking whether all containers are running the same version of "
                "Orchest."
            )
        try:
            version_exit_code = 0
            self.version(ext=True)
        except typer.Exit as e:
            version_exit_code = e.exit_code

        if version_exit_code == 2:
            # Could be caused because we are currently in a release
            # process causing different container versions to be up on
            # DockerHub. Or the user did not have enough disk space
            # available.
            utils.echo("Update was unsuccessful.")
            utils.echo(
                "Orchest was unable to pull the latest version of its currently"
                " pulled images. Please make sure you have enough disk space"
                " available. Or if you have plently of disk space available,"
                " try updating again later (~30 minutes should work)."
            )
            raise typer.Exit(code=1)

        if mode == "web":
            utils.echo("Update completed.")
        else:
            utils.echo("Update completed. To start Orchest again, run:")
            utils.echo("\torchest start")

    def _updateserver(self, port: int = 8000, cloud: bool = False, dev: bool = False):
        """Starts the update-server service."""
        logger.info("Starting Orchest update service...")

        config_ = {}
        container_config = spec.get_container_config(port=port, cloud=cloud, dev=dev)
        config_["update-server"] = container_config["update-server"]

        self.docker_client.run_containers(config_, use_name=True, detach=True)

    def debug(self, ext: bool, compress: bool):
        debug_dump(ext, compress)

    def run(self, job_name, project_name, pipeline_name, wait=False, rm=False):
        """Queues the pipeline as a one-time job."""
        # Orchest has to be running for this command to work, since we
        # will be querying the orchest-webserver directly.
        _, running_containers = self.resource_manager.get_containers(state="running")
        if not utils.is_orchest_running(running_containers):
            utils.echo("Orchest has to be running in order to queue a job. Run:")
            utils.echo("\torchest start")
            raise typer.Exit(code=1)

        wait_msg_template = "[{endpoint}]: Could not reach Orchest."
        base_url = f"{config.ORCHEST_WEBSERVER_ADDRESS}{{path}}"

        # Get project information.
        status_code, resp = utils.retry_func(
            utils.get_response,
            _wait_msg=wait_msg_template.format(endpoint="projects"),
            url=base_url.format(path="/async/projects"),
        )
        if status_code != 200:
            utils.echo(f"[projects]: Unexpected status code: {status_code}.")
            raise typer.Exit(code=1)
        for project in resp:
            # NOTE: We use here that a project name/path is unique.
            if project["path"] == project_name:
                project_uuid = project["uuid"]
                break
        else:
            utils.echo("The given project does not exist.")
            raise typer.Exit(code=1)

        # Get pipeline information.
        status_code, resp = utils.retry_func(
            utils.get_response,
            _wait_msg=wait_msg_template.format(endpoint="pipelines"),
            url=base_url.format(path=f"/async/pipelines/{project_uuid}"),
        )
        if status_code != 200:
            utils.echo(f"[pipelines]: Unexpected status code: {status_code}.")
            raise typer.Exit(code=1)
        for pipeline in resp["result"]:
            if pipeline["name"] == pipeline_name:
                pipeline_uuid = pipeline["uuid"]
                break
        else:
            utils.echo("The given pipeline does not exist in the given project.")
            raise typer.Exit(code=1)

        # Environments must be validated before POSTING the job draft,
        # because image locking happens the moment a job is created.
        repeat = True
        allowed_build_failures = config.ALLOWED_BUILD_FAILURES
        while repeat:
            try:
                status_code, resp = utils.retry_func(
                    utils.get_response,
                    _wait_msg="[jobs]: Some environment builds have not yet succeeded.",
                    url=base_url.format(
                        path="/catch/api-proxy/api/validations/environments"
                    ),
                    data={"project_uuid": project_uuid},
                    method="POST",
                )
            except RuntimeError:
                utils.echo(config.INTERNAL_ERR_MESSAGE)
                raise typer.Exit(code=1)
            else:
                if status_code != 201:
                    utils.echo(f"[validations]: Unexpected status code: {status_code}.")
                    raise typer.Exit(code=1)

                repeat = resp.get("validation") != "pass"
                if repeat:
                    # Try to solve each failure. See
                    # namespace_validations for details about the
                    # response.
                    builds = []
                    for env_uuid, action in zip(resp.get("fail"), resp.get("actions")):

                        if action in ["BUILD", "RETRY"]:
                            if action == "RETRY":
                                allowed_build_failures -= 1
                                if allowed_build_failures <= 0:
                                    msg = (
                                        "An environment has reached the "
                                        "maximum build attempts, exiting."
                                    )
                                    utils.echo(msg)
                                    raise typer.Exit(code=1)

                            builds.append(
                                {
                                    "project_uuid": project_uuid,
                                    "environment_uuid": env_uuid,
                                }
                            )

                    if builds:
                        msg = "Some environments are not built, issuing builds."
                        if "RETRY" in resp.get("actions"):
                            msg += " Some environments have previously failed to build."
                        utils.echo(msg)
                        try:
                            status_code, _ = utils.retry_func(
                                utils.get_response,
                                _wait_msg=wait_msg_template.format(
                                    endpoint="environments-builds"
                                ),
                                data={"environment_build_requests": builds},
                                url=base_url.format(
                                    path="/catch/api-proxy/api/environment-builds"
                                ),
                                method="POST",
                            )
                        except RuntimeError:
                            utils.echo(config.INTERNAL_ERR_MESSAGE)
                            raise typer.Exit(code=1)

                        if status_code != 200:
                            utils.echo(
                                "[environments-builds]: Unexpected status code: "
                                f"{status_code}."
                            )
                            raise typer.Exit(code=1)

                    utils.echo(
                        "[Waiting]: some environment builds have not yet succeeded."
                    )
                    time.sleep(3)

        # Draft job.
        try:
            utils.echo("Creating draft job.")
            status_code, resp = utils.retry_func(
                utils.get_response,
                _wait_msg=wait_msg_template.format(endpoint="jobs"),
                url=base_url.format(path="/catch/api-proxy/api/jobs/"),
                data={
                    "draft": True,
                    "project_uuid": project_uuid,
                    "pipeline_uuid": pipeline_uuid,
                    "pipeline_name": pipeline_name,
                    "name": job_name,
                    "parameters": [],
                    "pipeline_run_spec": {
                        "run_type": "full",
                        "uuids": None,  # argument is ignored due to "full"
                    },
                },
                method="POST",
            )
        except RuntimeError:
            utils.echo(config.INTERNAL_ERR_MESSAGE)
            raise typer.Exit(code=1)
        if status_code != 201:
            utils.echo(f"[jobs]: Unexpected status code: {status_code}.")
            raise typer.Exit(code=1)
        job_uuid = resp["uuid"]

        # Get pipeline definition needed to construct the stategy json.
        _, resp = utils.retry_func(
            utils.get_response,
            _wait_msg=wait_msg_template.format(endpoint="pipelines"),
            url=base_url.format(
                path=f"/async/pipelines/json/{project_uuid}/{pipeline_uuid}"
            ),
        )
        if resp["success"]:
            pipeline_definition = json.loads(resp["pipeline_json"])
        else:
            utils.echo("Could not obtain the pipeline definition.")
            raise typer.Exit(code=1)

        utils.echo("Queueing job.")
        parameters, strategy_json = construct_parameters_payload(pipeline_definition)
        status_code, resp = utils.retry_func(
            utils.get_response,
            _wait_msg=wait_msg_template.format(endpoint="jobs"),
            url=base_url.format(path=f"/catch/api-proxy/api/jobs/{job_uuid}"),
            data={
                "confirm_draft": True,
                "env_variables": {},  # TODO
                "parameters": [parameters],
                "strategy_json": strategy_json,
            },
            method="PUT",
        )
        if status_code != 200:
            utils.echo(f"[jobs]: Unexpected status code: {status_code}.")
            raise typer.Exit(code=1)

        utils.echo(
            f"Successfully queued the {pipeline_name} pipeline as a one-time job."
        )

        if not wait:
            return

        repeat = True
        end_states = ["SUCCESS", "ABORTED", "FAILURE"]
        while repeat:
            try:
                status_code, resp = utils.retry_func(
                    utils.get_response,
                    _wait_msg=wait_msg_template.format(endpoint="jobs"),
                    url=base_url.format(path=f"/catch/api-proxy/api/jobs/{job_uuid}"),
                )
            except RuntimeError:
                utils.echo(config.INTERNAL_ERR_MESSAGE)
                raise typer.Exit(code=1)
            else:
                if status_code != 200:
                    utils.echo(f"[jobs]: Unexpected status code: {status_code}.")
                    raise typer.Exit(code=1)

                repeat = resp.get("status") not in end_states

                if repeat:
                    utils.echo("[Waiting]: job has not finished running yet.")
                    time.sleep(3)

        utils.echo(f"Successfully ran the {pipeline_name} pipeline as a one-time job.")

        if not rm:
            return

        # Remove the job.
        utils.echo("Removing job.")
        status_code, resp = utils.retry_func(
            utils.get_response,
            _wait_msg=wait_msg_template.format(endpoint="jobs"),
            url=base_url.format(path=f"/catch/api-proxy/api/jobs/cleanup/{job_uuid}"),
            method="DELETE",
        )
        if status_code != 200:
            utils.echo(f"[jobs]: Unexpected status code: {status_code}.")
            utils.echo("Could not remove job.")
            raise typer.Exit(code=1)

        utils.echo("Successfully removed job state.")

    def _is_restarting(self) -> bool:
        """Check if Orchest is restarting.

        Returns:
            True if there is another instance of orchest-ctl issuing a
            restart, False otherwise.
        """
        containers, _ = self.docker_client.get_containers(
            full_info=True, label="maintainer=Orchest B.V. https://www.orchest.io"
        )
        cmd = utils.ctl_command_pattern.format(cmd="restart")
        for cont in containers:
            if (
                # Ignore the container in which we are running.
                not cont["Id"].startswith(os.environ["HOSTNAME"])
                and
                # Can't check through the image name because if the
                # image has become dangling/outdated while the container
                # is running the name will be an hash instead of
                # "orchest-ctl".
                re.match(cmd, cont["Command"].strip())
            ):
                return True
        return False

    def _is_updating(self) -> bool:
        """Check if Orchest is updating.

        Returns:
            True if there is another instance of orchest-ctl issuing an
            update, False otherwise.
        """
        containers, _ = self.docker_client.get_containers(
            full_info=True, label="maintainer=Orchest B.V. https://www.orchest.io"
        )
        cmd = utils.ctl_command_pattern.format(cmd="update")
        for cont in containers:
            if (
                # Ignore the container in which we are running.
                not cont["Id"].startswith(os.environ["HOSTNAME"])
                and re.match(cmd, cont["Command"].strip())
            ):
                return True
        return False


# TODO: Could potentially make this into set as well.
def get_required_images(language: Optional[str], gpu: bool = False) -> List[str]:
    """Returns the needed image for the given install configuration."""
    language_images = {
        "python": ["orchest/base-kernel-py:latest"],
        "r": ["orchest/base-kernel-r:latest"],
        "julia": ["orchest/base-kernel-julia:latest"],
    }
    gpu_images = {
        "python": ["orchest/base-kernel-py-gpu:latest"],
    }

    required_images = config.ORCHEST_IMAGES["minimal"]

    if language == "all":
        for lang, _ in language_images.items():
            required_images += language_images[lang]

            if lang in gpu_images:
                required_images += gpu_images[lang]

    elif language is not None:
        required_images += language_images[language]

        if gpu:
            required_images += gpu_images[language]

    return required_images


def construct_parameters_payload(pipeline_definition: dict) -> Tuple[dict, dict]:
    """Constructs the parameter payload for a one-off job.

    Returns:
        `parameters`: The default parameters for every step from the
            `pipeline_definition`.
        `stategy_json`: Strategy dictionary as required by the job.

    """

    def parse_parameters_format(value: dict) -> dict:
        """Parses the parameter values to the correct format.

        The format for the strategy JSON parameters is:
            {a: "[1]", b: "[2]"}
        whereas, the given value is:
            {a: 1, b: 2}

        """
        return {p: str([v]) for p, v in value.items()}

    strategy_json = {}
    parameters = {}
    for step_uuid, step_props in pipeline_definition["steps"].items():
        if step_props["parameters"]:
            strategy_json[step_uuid] = {
                "key": step_uuid,
                "title": step_props["title"],
                "parameters": parse_parameters_format(step_props["parameters"]),
            }
            parameters[step_uuid] = step_props["parameters"]

    return parameters, strategy_json
