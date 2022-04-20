from flask import request
from flask.globals import current_app
from flask_restx import Namespace, Resource, marshal
from sqlalchemy import desc

import app.models as models
from _orchest.internals import config as _config
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import errors as self_errors
from app import schema
from app.apis.namespace_runs import AbortPipelineRun
from app.connections import db
from app.core import environments, sessions
from app.errors import JupyterEnvironmentBuildInProgressException
from app.types import InteractiveSessionConfig, SessionType
from app.utils import register_schema

api = Namespace("sessions", description="Manage interactive sessions")
api = register_schema(api)


@api.route("/")
class SessionList(Resource):
    @api.doc("fetch_sessions")
    @api.marshal_with(schema.sessions)
    def get(self):
        """Fetches all sessions."""
        query = models.InteractiveSession.query

        # TODO: why is this used instead of the Session.get() ?
        # Ability to query a specific session given its `pipeline_uuid`
        # through the URL (using `request.args`).
        if "pipeline_uuid" in request.args and "project_uuid" in request.args:
            query = query.filter_by(
                pipeline_uuid=request.args.get("pipeline_uuid")
            ).filter_by(project_uuid=request.args.get("project_uuid"))
        elif "project_uuid" in request.args:
            query = query.filter_by(project_uuid=request.args.get("project_uuid"))

        sessions = query.all()

        return {"sessions": [session.as_dict() for session in sessions]}, 200

    @api.doc("launch_session")
    @api.expect(schema.session_config)
    def post(self):
        """Launches an interactive session."""
        session_config = request.get_json()

        isess = models.InteractiveSession.query.filter_by(
            project_uuid=session_config["project_uuid"],
            pipeline_uuid=session_config["pipeline_uuid"],
        ).one_or_none()
        if isess is not None:
            return {"message": "Session already exists."}, 409

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                CreateInteractiveSession(tpe).transaction(session_config)
        except JupyterEnvironmentBuildInProgressException:
            return {"message": "JupyterEnvironmentBuildInProgress"}, 423
        except Exception as e:
            current_app.logger.error(e)
            return {"message": str(e)}, 500

        isess = models.InteractiveSession.query.filter_by(
            project_uuid=session_config["project_uuid"],
            pipeline_uuid=session_config["pipeline_uuid"],
        ).one_or_none()

        # Can't rely on the 2PE raising an exception because the
        # collateral effect is invoking a background job, if that fails,
        # it will clean up the session.
        if isess is None:
            return {"message": "Could not start session."}, 500

        return marshal(isess.as_dict(), schema.session), 201


@api.route("/<string:project_uuid>/<string:pipeline_uuid>")
@api.param("project_uuid", "UUID of project")
@api.param("pipeline_uuid", "UUID of pipeline")
@api.response(404, "Session not found")
class Session(Resource):
    """Manages interactive sessions.

    There can only be 1 interactive session per pipeline. Interactive
    sessions are uniquely identified by the pipeline's UUID.
    """

    @api.doc("get_session")
    @api.marshal_with(schema.session)
    def get(self, project_uuid, pipeline_uuid):
        """Fetch a session given the pipeline UUID."""
        session = models.InteractiveSession.query.get_or_404(
            ident=(project_uuid, pipeline_uuid), description="Session not found."
        )
        return session.as_dict()

    @api.doc("shutdown_session")
    @api.response(200, "Session stopped")
    @api.response(404, "Session not found")
    def delete(self, project_uuid, pipeline_uuid):
        """Shutdowns session."""

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                could_shutdown = StopInteractiveSession(tpe).transaction(
                    project_uuid, pipeline_uuid, async_mode=True
                )
        except Exception as e:
            return {"message": str(e)}, 500

        if could_shutdown:
            return {"message": "Session shutdown was successful."}, 200
        else:
            return {"message": "Session not found."}, 404

    @api.doc("restart_memory_server_of_session")
    @api.response(200, "Session resource memory-server restarted")
    @api.response(404, "Session not found")
    def put(self, project_uuid, pipeline_uuid):
        """Restarts the memory-server of the session."""

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                could_restart = RestartMemoryServer(tpe).transaction(
                    project_uuid, pipeline_uuid
                )
        except Exception as e:
            return {"message": str(e)}, 500

        if not could_restart:
            return {"message": "SessionNotRunning"}, 500

        return {"message": "Session restart was successful."}, 200


@api.route(
    "/kernels/lock-image/<string:project_uuid>/<string:pipeline_uuid>/"
    "<string:environment_uuid>"
)
@api.param("project_uuid", "UUID of project")
@api.param("pipeline_uuid", "UUID of pipeline")
@api.param("environment_uuid", "UUID of the environment")
@api.response(404, "Session not found")
class SessionKernelImageLock(Resource):
    """For kernels to request which image to use for an environment.

    The environment image that is returned will be considered as in use
    by the session until the session is stopped.
    """

    @api.doc("get_kernel_image")
    @api.marshal_with(schema.environment_image)
    def get(self, project_uuid, pipeline_uuid, environment_uuid):
        """Lock and get the environment image to use for the kernel."""
        models.InteractiveSession.query.get_or_404(
            ident=(project_uuid, pipeline_uuid), description="Session not found."
        )
        images = environments.lock_environment_images_for_interactive_session(
            project_uuid, pipeline_uuid, set([environment_uuid])
        )
        db.session.commit()
        return images[environment_uuid]


class CreateInteractiveSession(TwoPhaseFunction):
    def _transaction(self, session_config: InteractiveSessionConfig):

        # Gate check to see if there is a Jupyter lab build active
        latest_jupyter_image_build = models.JupyterImageBuild.query.order_by(
            desc(models.JupyterImageBuild.requested_time)
        ).first()

        if (
            latest_jupyter_image_build is not None
            and latest_jupyter_image_build.status
            in [
                "PENDING",
                "STARTED",
            ]
        ):
            raise JupyterEnvironmentBuildInProgressException()

        # Lock the orchest environment images that are used as services.
        env_as_services = set()
        prefix = _config.ENVIRONMENT_AS_SERVICE_PREFIX
        for service in session_config.get("services", {}).values():
            img = service["image"]
            if img.startswith(prefix):
                env_as_services.add(img.replace(prefix, ""))

        interactive_session = {
            "project_uuid": session_config["project_uuid"],
            "pipeline_uuid": session_config["pipeline_uuid"],
            "status": "LAUNCHING",
            # NOTE: the definition of a service is currently
            # persisted to disk and considered to be versioned,
            # meaning that nothing in there is considered to be
            # secret. If this changes, this dictionary needs to
            # have secrets removed.
            "user_services": session_config.get("services", {}),
        }
        db.session.add(models.InteractiveSession(**interactive_session))

        try:
            env_uuid_to_image = (
                environments.lock_environment_images_for_interactive_session(
                    session_config["project_uuid"],
                    session_config["pipeline_uuid"],
                    env_as_services,
                )
            )
            for env_uuid, image in env_uuid_to_image.items():
                env_uuid_to_image[env_uuid] = (
                    _config.ENVIRONMENT_IMAGE_NAME.format(
                        project_uuid=session_config["project_uuid"],
                        environment_uuid=env_uuid,
                    )
                    + f":{image.tag}"
                )
        except self_errors.ImageNotFound as e:
            raise self_errors.ImageNotFound(
                "Pipeline services were referencing environments for "
                f"which an image does not exist, {e}."
            )
        except self_errors.PipelineDefinitionNotValid:
            msg = "Please make sure every pipeline step is assigned an environment."
            raise self_errors.PipelineDefinitionNotValid(msg)
        session_config["env_uuid_to_image"] = env_uuid_to_image

        session_uuid = (
            session_config["project_uuid"][:18] + session_config["pipeline_uuid"][:18]
        )
        self.collateral_kwargs["session_uuid"] = session_uuid
        self.collateral_kwargs["session_config"] = session_config

    @classmethod
    def _should_abort_session_start(cls, project_uuid, pipeline_uuid) -> bool:
        session_entry = models.InteractiveSession.query.filter_by(
            project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
        ).one_or_none()
        # Has been stopped or is in the process of being stopped.
        return session_entry is None or session_entry.status != "LAUNCHING"

    @classmethod
    def _background_session_start(
        cls, app, session_uuid: str, session_config: InteractiveSessionConfig
    ):

        with app.app_context():
            try:
                project_uuid = session_config["project_uuid"]
                pipeline_uuid = session_config["pipeline_uuid"]

                sessions.launch(
                    session_uuid,
                    SessionType.INTERACTIVE,
                    session_config,
                    should_abort=lambda: cls._should_abort_session_start(
                        project_uuid, pipeline_uuid
                    ),
                )

                # with_for_update to avoid overwriting the state of a
                # STOPPING instance.
                session_entry = (
                    models.InteractiveSession.query.with_for_update()
                    .populate_existing()
                    .filter_by(project_uuid=project_uuid, pipeline_uuid=pipeline_uuid)
                    .one_or_none()
                )
                if session_entry is None:
                    return

                # Do not overwrite the STOPPING status if the session is
                # stopping.
                if session_entry.status == "LAUNCHING":
                    session_entry.status = "RUNNING"

                db.session.commit()
            except Exception as e:
                current_app.logger.error(e)

                # Avoid cases where "current transaction is aborted,
                # commands ignored until end of transaction block".
                db.session.commit()

                # Attempt containers cleanup.
                try:
                    sessions.cleanup_resources(session_uuid, wait_for_completion=True)
                except Exception:
                    pass

                # If it does not succeed then the initial entry has to
                # be removed from the database as otherwise no session
                # can be started in the future due to the uniqueness
                # constraint.
                models.InteractiveSession.query.filter_by(
                    project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
                ).delete()
                db.session.commit()

    def _collateral(
        self,
        *args,
        **kwargs,
    ):

        current_app.config["SCHEDULER"].add_job(
            CreateInteractiveSession._background_session_start,
            # From the docs:
            # Return the current object.  This is useful if you want the
            # real object behind the proxy at a time for performance
            # reasons or because you want to pass the object into a
            # different context.
            args=[current_app._get_current_object(), *args],
            kwargs=kwargs,
        )


class StopInteractiveSession(TwoPhaseFunction):
    def _transaction(
        self, project_uuid: str, pipeline_uuid: str, async_mode: bool = False
    ):

        session = (
            models.InteractiveSession.query.with_for_update()
            .populate_existing()
            .filter_by(project_uuid=project_uuid, pipeline_uuid=pipeline_uuid)
            .one_or_none()
        )
        if session is None:
            self.collateral_kwargs["session_uuid"] = None
            self.collateral_kwargs["project_uuid"] = None
            self.collateral_kwargs["pipeline_uuid"] = None
            self.collateral_kwargs["async_mode"] = async_mode
            return False
        else:
            # Abort interactive run if it was PENDING/STARTED.
            run = models.InteractivePipelineRun.query.filter(
                models.InteractivePipelineRun.project_uuid == project_uuid,
                models.InteractivePipelineRun.pipeline_uuid == pipeline_uuid,
                models.InteractivePipelineRun.status.in_(["PENDING", "STARTED"]),
            ).one_or_none()
            if run is not None:
                AbortPipelineRun(self.tpe).transaction(run.uuid)

            session.status = "STOPPING"
            session_uuid = project_uuid[:18] + pipeline_uuid[:18]
            self.collateral_kwargs["session_uuid"] = session_uuid
            self.collateral_kwargs["project_uuid"] = project_uuid
            self.collateral_kwargs["pipeline_uuid"] = pipeline_uuid
            self.collateral_kwargs["async_mode"] = async_mode
        return True

    @classmethod
    def _session_stop(
        cls,
        app,
        session_uuid: str,
        project_uuid: str,
        pipeline_uuid: str,
    ):

        with app.app_context():
            try:
                sessions.shutdown(session_uuid, wait_for_completion=True)
            finally:
                # Make sure that the session is deleted in any case,
                # because otherwise the user will not be able to have an
                # active session for the given pipeline.
                session = models.InteractiveSession.query.filter_by(
                    project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
                ).one()
                db.session.delete(session)
                db.session.commit()

    def _collateral(
        self, session_uuid: str, project_uuid: str, pipeline_uuid: str, async_mode: bool
    ):
        # Could be none when the _transaction call sets them to None
        # because there is no session to shutdown. This is a way that
        # the _transaction function effectively tells the _collateral
        # function to not be run.
        if project_uuid is None or pipeline_uuid is None:
            return

        if async_mode:
            current_app.config["SCHEDULER"].add_job(
                StopInteractiveSession._session_stop,
                args=[
                    current_app._get_current_object(),
                    session_uuid,
                    project_uuid,
                    pipeline_uuid,
                ],
            )
        else:
            StopInteractiveSession._session_stop(
                current_app._get_current_object(),
                session_uuid,
                project_uuid,
                pipeline_uuid,
            )


class RestartMemoryServer(TwoPhaseFunction):
    def _transaction(
        self,
        project_uuid: str,
        pipeline_uuid: str,
    ):

        session = models.InteractiveSession.query.filter_by(
            project_uuid=project_uuid, pipeline_uuid=pipeline_uuid, status="RUNNING"
        ).one_or_none()

        if session is None:
            self.collateral_kwargs["session_uuid"] = None
            return False
        else:
            # Abort interactive run if it was PENDING/STARTED.
            run = models.InteractivePipelineRun.query.filter(
                models.InteractivePipelineRun.project_uuid == project_uuid,
                models.InteractivePipelineRun.pipeline_uuid == pipeline_uuid,
                models.InteractivePipelineRun.status.in_(["PENDING", "STARTED"]),
            ).one_or_none()
            if run is not None:
                AbortPipelineRun(self.tpe).transaction(run.uuid)

            self.collateral_kwargs["session_uuid"] = (
                project_uuid[:18] + pipeline_uuid[:18]
            )

        return True

    def _collateral(self, session_uuid: str):
        if session_uuid is not None:
            sessions.restart_session_service(session_uuid, "memory-server", True)
