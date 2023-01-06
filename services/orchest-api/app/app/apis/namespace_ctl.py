"""API endpoints for unspecified orchest-api level information."""
import os
import shlex
import subprocess
from typing import List

from flask import current_app, request
from flask_restx import Namespace, Resource
from kubernetes import client
from orchestcli import cmds

from _orchest.internals import config as _config
from _orchest.internals.two_phase_executor import TwoPhaseExecutor
from app import models, schema, utils
from app.apis.namespace_environment_image_builds import AbortEnvironmentImageBuild
from app.apis.namespace_jobs import AbortJob, AbortJobPipelineRun
from app.apis.namespace_jupyter_image_builds import AbortJupyterEnvironmentBuild
from app.apis.namespace_runs import AbortInteractivePipelineRun
from app.apis.namespace_sessions import StopInteractiveSession
from app.connections import db, k8s_core_api
from app.core import scheduler, sessions
from config import CONFIG_CLASS

ns = Namespace("ctl", description="Orchest-api internal control.")
api = schema.register_schema(ns)

logger = utils.logger


@api.route("/start-update")
class StartUpdate(Resource):
    @api.doc("orchest_api_start_update")
    @api.marshal_with(
        schema.update_started_response,
        code=201,
        description="Update Orchest.",
    )
    def post(self):
        try:
            _run_update_in_venv(
                namespace=_config.ORCHEST_NAMESPACE,
                cluster_name=_config.ORCHEST_CLUSTER,
                dev_mode=(os.getenv("FLASK_ENV") == "development"),
            )
        except SystemExit:
            # This is a form of technical debt since we can't
            # distinguish if an update fails because there is no newer
            # version or a "real" failure.
            return {"message": "Failed to update."}, 500

        return {
            "namespace": _config.ORCHEST_NAMESPACE,
            "cluster_name": _config.ORCHEST_CLUSTER,
        }, 201


@api.route("/restart")
class Restart(Resource):
    @api.doc("orchest_api_restart")
    @ns.response(code=500, model=schema.dictionary, description="Invalid request")
    def post(self):
        try:
            cmds.OrchestCmds().restart(
                False,
                namespace=_config.ORCHEST_NAMESPACE,
                cluster_name=_config.ORCHEST_CLUSTER,
            )
            return {}, 201
        except SystemExit:
            return {"message": "Failed to restart."}, 500


@api.route("/orchest-images-to-pre-pull")
class OrchestImagesToPrePull(Resource):
    @api.doc("orchest_images_to_pre_pull")
    def get(self):
        """Orchest images to pre pull on all nodes for a better UX."""
        pre_pull_orchest_images = [
            CONFIG_CLASS.IMAGE_BUILDER_IMAGE,
            _config.ARGO_EXECUTOR_IMAGE,
            _config.CONTAINER_RUNTIME_IMAGE,
            f"docker.io/orchest/jupyter-server:{CONFIG_CLASS.ORCHEST_VERSION}",
            f"docker.io/orchest/base-kernel-py:{CONFIG_CLASS.ORCHEST_VERSION}",
            f"docker.io/orchest/jupyter-enterprise-gateway:{CONFIG_CLASS.ORCHEST_VERSION}",  # noqa
            f"docker.io/orchest/session-sidecar:{CONFIG_CLASS.ORCHEST_VERSION}",
        ]
        pre_pull_orchest_images = {"pre_pull_images": pre_pull_orchest_images}

        return pre_pull_orchest_images, 200


def _get_formatted_active_jupyter_imgs(
    stored_in_registry=None, in_node=None, not_in_node=None
) -> List[str]:
    active_custom_jupyter_images = utils.get_active_custom_jupyter_images(
        stored_in_registry=stored_in_registry, in_node=in_node, not_in_node=not_in_node
    )

    active_custom_jupyter_image_names = []
    registry_ip = utils.get_registry_ip()
    for img in active_custom_jupyter_images:
        active_custom_jupyter_image_names.append(
            f"{registry_ip}/{_config.JUPYTER_IMAGE_NAME}:{img.tag}"
        )
    return active_custom_jupyter_image_names


@api.route("/active-custom-jupyter-images")
@api.param("stored_in_registry")
@api.param("in_node")
@api.param("not_in_node")
class ActiveCustomJupyterImages(Resource):
    @api.doc("active_custom_jupyter_images")
    def get(self):
        # CLOUD
        active_custom_jupyter_images = _get_formatted_active_jupyter_imgs(
            stored_in_registry=request.args.get(
                "stored_in_registry", default=None, type=lambda v: v in ["True", "true"]
            ),
            in_node=request.args.get("in_node"),
            not_in_node=request.args.get("not_in_node"),
        )

        return {"active_custom_jupyter_images": active_custom_jupyter_images}, 200


@api.route("/active-custom-jupyter-images-to-push")
@api.param("in_node")
class ActiveCustomJupyterImagesToPush(Resource):
    @api.doc("active_custom_jupyter_images-to-push")
    def get(self):
        """To be used by the image-pusher to get images to push."""
        active_custom_jupyter_images = _get_formatted_active_jupyter_imgs(
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
            active_custom_jupyter_images = []

        return {"active_custom_jupyter_images": active_custom_jupyter_images}, 200


@api.route("/orchest-settings")
class OrchestSettings(Resource):
    @api.doc("get_orchest_settings")
    def get(self):
        """Get Orchest settings as a json."""

        # TODO: decide what kind of abstraction we want to cover this
        # case.
        config_as_dict = utils.OrchestSettings().as_dict()
        config_as_dict.pop("PAUSED", None)

        return config_as_dict, 200

    @api.doc("update_orchest_settings")
    @api.expect(schema.dictionary)
    @ns.response(code=200, model=schema.settings_update_response, description="Success")
    @ns.response(code=400, model=schema.dictionary, description="Invalid request")
    def put(self):
        """Update Orchest settings through a json.

        Works, essentially, as a dictionary update, it's an upsert.

        Returns the updated configuration. A 400 response with an error
        message is returned if any value is of the wrong type or
        invalid.
        """
        config = utils.OrchestSettings()
        config_update = request.get_json()
        try:
            config.update(config_update)
        except (TypeError, ValueError) as e:
            current_app.logger.debug(e, exc_info=True)
            return {"message": f"{e}"}, 400

        if config_update.get("PAUSED", False):
            current_app.config["SCHEDULER"].add_job(
                cleanup, args=[current_app._get_current_object()]
            )

        requires_restart = config.save(current_app)
        config_as_dict = utils.OrchestSettings().as_dict()
        config_as_dict.pop("PAUSED", None)
        resp = {"requires_restart": requires_restart, "user_config": config_as_dict}
        return resp, 200

    @api.doc("set_orchest_settings")
    @api.expect(schema.dictionary)
    @ns.response(code=200, model=schema.settings_update_response, description="Success")
    @ns.response(code=400, model=schema.dictionary, description="Invalid request")
    def post(self):
        """Replace Orchest settings through a json.

        Won't allow to remove values which have a defined default value
        and/or that shouldn't be removed.

        Returns the new configuration. A 400 response with an error
        message is returned if any value is of the wrong type or
        invalid.
        """
        config = utils.OrchestSettings()
        new_config = request.get_json()
        # Workaround for the fact that PAUSED is currently an hidden
        # setting.
        new_config["PAUSED"] = new_config.get("PAUSED", config["PAUSED"])

        try:
            config.set(new_config)
        except (TypeError, ValueError) as e:
            current_app.logger.debug(e, exc_info=True)
            return {"message": f"{e}"}, 400

        if new_config.get("PAUSED", False):
            current_app.config["SCHEDULER"].add_job(
                cleanup, args=[current_app._get_current_object()]
            )

        requires_restart = config.save(current_app)
        config_as_dict = utils.OrchestSettings().as_dict()
        config_as_dict.pop("PAUSED", None)
        resp = {"requires_restart": requires_restart, "user_config": config_as_dict}
        return resp, 200


def _run_update_in_venv(namespace: str, cluster_name: str, dev_mode: bool):
    """Runs `orchest update` in a virtualenv."""

    def run_cmds(**kwargs):
        """Executes the provided commands.

        Basically runs and handles `subprocess.Popen(**kwargs)`

        Args:
            cmds: commands to execute.

        Raises:
            SystemExit: If `returncode` of the cmds execution is not
                zero or fail_if_std_err is `True` and stderr is not
                None.
        """
        process = subprocess.Popen(**kwargs)

        if process.wait() != 0:
            raise SystemExit(1)

    if not dev_mode:
        install_cmd = " && ".join(
            [
                "rm -rf /tmp/venv",
                "python3 -m venv /tmp/venv",
                "/tmp/venv/bin/pip install --upgrade orchest-cli",
            ]
        )
        # Use `shell=True` so we can use `&&` to chain commands.
        run_cmds(args=install_cmd, shell=True)

    if dev_mode:
        import yaml  # installed by orchest-cli

        # Read the version to update to from the manifest. Without
        # it you can't update in dev mode.
        controller_deploy_path = (
            "/orchest/services/orchest-controller/deploy/k8s/orchest-controller.yaml"
        )
        with open(controller_deploy_path, "r") as f:
            txt_deploy_controller = f.read()

        version = None
        yml_deploy_controller = yaml.safe_load_all(txt_deploy_controller)
        while True:
            try:
                obj = next(yml_deploy_controller)

                if (
                    obj is not None
                    and obj["kind"] == "Deployment"
                    # NOTE: We need to assume something to not change
                    # in the controller deployment to be able to
                    # distinguish it from other defined deployments in
                    # the yaml file.
                    and obj["metadata"]["name"] == "orchest-controller"
                ):
                    containers = obj["spec"]["template"]["spec"]["containers"]
                    for container in containers:
                        if container["name"] == "orchest-controller":
                            version = container["image"].split(":")[-1]
                    break
            except StopIteration:
                current_app.logger.error("Could not infer version to update to.")
                raise SystemExit(1)

        if version is None:
            current_app.logger.error("Could not infer version to update to.")
            raise SystemExit(1)

        update_cmd = (
            f"orchest update --dev --version={version}"
            f" --no-watch --namespace={namespace} --cluster-name={cluster_name}"
        )

        # `orchest update --dev` only works inside root level
        # orchest folder
        run_cmds(args=shlex.split(update_cmd), cwd="/orchest")
    else:
        update_cmd = (
            "/tmp/venv/bin/orchest update"
            f" --no-watch --namespace={namespace} --cluster-name={cluster_name}"
        )

        run_cmds(args=shlex.split(update_cmd))


@api.route("/jupyter-images/<string:tag>/registry")
@api.param("tag", "Tag of the image")
class JupyterImageRegistryStatus(Resource):
    @api.doc("put_jupyter_image_as_pushed")
    def put(self, tag: str):
        """Notifies that the image has been pushed to the registry."""
        image = models.JupyterImage.query.get_or_404(
            ident=int(tag),
            description="Jupyter image not found.",
        )

        image.stored_in_registry = True
        db.session.commit()
        return {}, 200


@api.route("/jupyter-images/<string:tag>/node/<string:node>")
@api.param("tag", "Tag of the image")
@api.param("node", "Node on which the image was pulled")
class JupyterImageNodeStatus(Resource):
    @api.doc("put_jupyter_image_node_state")
    def put(self, tag: str, node: str):
        """Notifies that the image has been pulled to a node."""

        models.JupyterImage.query.get_or_404(
            ident=int(tag),
            description="Jupyter image not found.",
        )
        utils.upsert_jupyter_image_on_node(tag, node)
        db.session.commit()
        return {}, 200


def cleanup(app) -> None:
    with app.app_context():
        app.logger.info("Starting app cleanup.")

        try:
            app.logger.info("Aborting git imports.")
            git_imports = models.GitImport.query.filter(
                models.GitImport.status.in_(["STARTED"])
            ).all()
            for git_import in git_imports:
                app.logger.info(f"Aborting git import {git_import.uuid}.")

                try:
                    k8s_core_api.delete_namespaced_pod(
                        f"git-import-{git_import.uuid}",
                        _config.ORCHEST_NAMESPACE,
                    )
                except client.ApiException as e:
                    if e.status != 404:
                        raise

            models.GitImport.query.filter(
                models.GitImport.status.in_(["STARTED"])
            ).update({"status": "ABORTED"})

            app.logger.info("Aborting interactive pipeline runs.")
            runs = models.InteractivePipelineRun.query.filter(
                models.InteractivePipelineRun.status.in_(["PENDING", "STARTED"])
            ).all()
            with TwoPhaseExecutor(db.session) as tpe:
                for run in runs:
                    AbortInteractivePipelineRun(tpe).transaction(run.uuid)

            app.logger.info("Shutting down interactive sessions.")
            int_sessions = models.InteractiveSession.query.all()
            with TwoPhaseExecutor(db.session) as tpe:
                for session in int_sessions:
                    StopInteractiveSession(tpe).transaction(
                        session.project_uuid, session.pipeline_uuid, async_mode=False
                    )

            app.logger.info("Aborting environment builds.")
            builds = models.EnvironmentImageBuild.query.filter(
                models.EnvironmentImageBuild.status.in_(["PENDING", "STARTED"])
            ).all()
            with TwoPhaseExecutor(db.session) as tpe:
                for build in builds:
                    AbortEnvironmentImageBuild(tpe).transaction(
                        build.project_uuid,
                        build.environment_uuid,
                        build.image_tag,
                    )

            app.logger.info("Aborting jupyter builds.")
            builds = models.JupyterImageBuild.query.filter(
                models.JupyterImageBuild.status.in_(["PENDING", "STARTED"])
            ).all()
            with TwoPhaseExecutor(db.session) as tpe:
                for build in builds:
                    AbortJupyterEnvironmentBuild(tpe).transaction(build.uuid)

            app.logger.info("Aborting running one off jobs.")
            jobs = models.Job.query.filter_by(schedule=None, status="STARTED").all()
            with TwoPhaseExecutor(db.session) as tpe:
                for job in jobs:
                    AbortJob(tpe).transaction(job.uuid)

            app.logger.info("Aborting running pipeline runs of cron jobs.")
            runs = models.NonInteractivePipelineRun.query.filter(
                models.NonInteractivePipelineRun.status.in_(["STARTED"])
            ).all()
            with TwoPhaseExecutor(db.session) as tpe:
                for run in runs:
                    AbortJobPipelineRun(tpe).transaction(run.job_uuid, run.uuid)

            # Delete old JupyterEnvironmentBuilds on to avoid
            # accumulation in the DB. Leave the latest such that the
            # user can see details about the last executed build after
            # restarting Orchest.
            jupyter_image_builds = (
                models.JupyterImageBuild.query.order_by(
                    models.JupyterImageBuild.requested_time.desc()
                )
                .offset(1)
                .all()
            )
            # Can't use offset and .delete in conjunction in sqlalchemy
            # unfortunately.
            for jupyter_image_build in jupyter_image_builds:
                db.session.delete(jupyter_image_build)

            models.SchedulerJob.query.filter(
                models.SchedulerJob.status == "STARTED"
            ).update({"status": "FAILED"})

            db.session.commit()

            _cleanup_dangling_sessions(app)

        except Exception as e:
            app.logger.error("Cleanup failed.")
            app.logger.error(e)


def _cleanup_dangling_sessions(app):
    """Shuts down all sessions in the namespace.

    This is a cheap fallback in case session deletion didn't happen when
    needed because, for example, of the k8s-api being down or being
    unresponsive during high load. Over time this should/could be
    substituted with a more refined approach where non interactive
    sessions are stored in the db.

    """
    app.logger.info("Cleaning up dangling sessions.")
    pods = k8s_core_api.list_namespaced_pod(
        namespace=_config.ORCHEST_NAMESPACE,
        # Can't use a field selector to select pods in 'not Terminating
        # phase, see
        # https://kubernetes.io/docs/concepts/workloads/pods/_print/ ,
        # "This Terminating status is not one of the Pod phases.". This
        # means we could catch pods of a session that are already being
        # terminated. Note that when cleaning up interactive sessions in
        # 'cleanup()' we wait for the session to be actually cleaned up
        # through the argument async=False, so pods from interactive
        # sessions won't be caught in this call.
        label_selector="session_uuid",
    )
    sessions_to_cleanup = {pod.metadata.labels["session_uuid"] for pod in pods.items}
    for uuid in sessions_to_cleanup:
        app.logger.info(f"Cleaning up session {uuid}")
        try:
            sessions.shutdown(uuid, wait_for_completion=False)
        # A session getting cleaned up through this logic is already
        # an unexpected state, so let's be on the safe side.
        except Exception as e:
            app.logger.warning(e)
