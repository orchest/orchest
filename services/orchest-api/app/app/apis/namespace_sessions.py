import time
from typing import Any, Dict

from docker import errors
from flask import request
from flask.globals import current_app
from flask_restx import Namespace, Resource, marshal
from sqlalchemy import desc
from sqlalchemy.orm import lazyload

import app.models as models
from _orchest.internals import config as _config
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema
from app.apis.namespace_runs import AbortPipelineRun
from app.connections import db, docker_client
from app.core.sessions import InteractiveSession
from app.errors import JupyterBuildInProgressException
from app.utils import (
    get_env_uuids_to_docker_id_mappings,
    lock_environment_images_for_session,
    register_schema,
)

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
        except JupyterBuildInProgressException:
            return {"message": "JupyterBuildInProgress"}, 423
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
                    project_uuid, pipeline_uuid
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


class CreateInteractiveSession(TwoPhaseFunction):
    def _transaction(self, session_config: Dict[str, Any]):

        # Gate check to see if there is a Jupyter lab build active
        latest_jupyter_build = models.JupyterBuild.query.order_by(
            desc(models.JupyterBuild.requested_time)
        ).first()

        if latest_jupyter_build is not None and latest_jupyter_build.status in [
            "PENDING",
            "STARTED",
        ]:
            raise JupyterBuildInProgressException()

        # Make sure the service environments are there. This piece of
        # code needs to be there to reject a session post if the
        # referenced environments aren't there, since this is something
        # the background task that is launching the session cannot do.
        env_as_services = set()
        prefix = _config.ENVIRONMENT_AS_SERVICE_PREFIX
        for service in session_config.get("services", {}).values():
            img = service["image"]
            if img.startswith(prefix):
                env_as_services.add(img.replace(prefix, ""))
        try:
            get_env_uuids_to_docker_id_mappings(
                session_config["project_uuid"], env_as_services
            )
        except errors.ImageNotFound as e:
            raise errors.ImageNotFound(
                "Pipeline services were referencing environments for "
                f"which an image does not exist, {e}."
            )

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

        self.collateral_kwargs["session_config"] = session_config

    @classmethod
    def _background_session_start(cls, app, session_config: Dict[str, Any]):

        with app.app_context():
            try:
                project_uuid = session_config["project_uuid"]
                pipeline_uuid = session_config["pipeline_uuid"]

                env_as_services = set()
                prefix = _config.ENVIRONMENT_AS_SERVICE_PREFIX
                for service in session_config.get("services", {}).values():
                    img = service["image"]
                    if img.startswith(prefix):
                        env_as_services.add(img.replace(prefix, ""))

                # Lock the orchest environment images that are used
                # as services.
                env_uuid_docker_id_mappings = lock_environment_images_for_session(
                    project_uuid, pipeline_uuid, env_as_services
                )
                session_config[
                    "env_uuid_docker_id_mappings"
                ] = env_uuid_docker_id_mappings

                session = InteractiveSession(
                    docker_client, network=_config.DOCKER_NETWORK
                )
                session.launch(
                    session_config,
                )

                # Update the database entry with information to connect
                # to the launched resources.
                IP = session.get_containers_IP()

                # with for update to avoid overwriting the state of a
                # STOPPING instance.
                session_entry = (
                    models.InteractiveSession.query
                    # The lazyload is because you can't lock for update
                    # such a relationship (nullable FK).
                    .options(lazyload(models.InteractiveSession.image_mappings))
                    .with_for_update()
                    .populate_existing()
                    .filter_by(project_uuid=project_uuid, pipeline_uuid=pipeline_uuid)
                    .one_or_none()
                )
                if session_entry is None:
                    return

                session_entry.container_ids = session.get_container_IDs()
                session_entry.jupyter_server_ip = IP.jupyter_server
                session_entry.notebook_server_info = session.notebook_server_info

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
                    session.shutdown()
                except Exception:
                    pass

                # Error handling. If it does not succeed then the
                # initial entry has to be removed from the database as
                # otherwise no session can be started in the future due
                # to the uniqueness constraint.
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
        self,
        project_uuid: str,
        pipeline_uuid: str,
    ):

        # The with for update is to avoid a race condition where
        # updating the status to STOPPING would overwrite a RUNNING
        # status after reading the previous_state as LAUNCHING, which
        # would then cause the collateral effect to wait the full time
        # before shutting down the session.
        session = (
            models.InteractiveSession.query.options(
                lazyload(models.InteractiveSession.image_mappings)
            )
            .with_for_update()
            .populate_existing()
            .filter_by(project_uuid=project_uuid, pipeline_uuid=pipeline_uuid)
            .one_or_none()
        )
        if session is None:
            self.collateral_kwargs["project_uuid"] = None
            self.collateral_kwargs["pipeline_uuid"] = None
            self.collateral_kwargs["container_ids"] = None
            self.collateral_kwargs["notebook_server_info"] = None
            self.collateral_kwargs["previous_state"] = None
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

            previous_state = session.status
            session.status = "STOPPING"
            self.collateral_kwargs["project_uuid"] = project_uuid
            self.collateral_kwargs["pipeline_uuid"] = pipeline_uuid

            # This data is kept here instead of querying again in the
            # collateral phase because when deleting a project the
            # project deletion (in the transactional phase) will cascade
            # delete the session, so the collateral phase would not be
            # able to find the session by querying the db.
            self.collateral_kwargs["container_ids"] = session.container_ids
            self.collateral_kwargs[
                "notebook_server_info"
            ] = session.notebook_server_info
            self.collateral_kwargs["previous_state"] = previous_state

        return True

    @classmethod
    def _background_session_stop(
        cls,
        app,
        project_uuid: str,
        pipeline_uuid: str,
        container_ids: Dict[str, str],
        notebook_server_info: Dict[str, str],
        previous_state: str,
    ):

        # Note that a session that is still LAUNCHING should not be
        # killed until it has done launching, because the jupyterlab
        # user configuration is managed through a lock that is removed
        # by the jupyterlab start script. See PR #254.
        with app.app_context():
            try:
                # Wait for the session to be STARTED before killing it.
                if previous_state == "LAUNCHING":
                    n = 600
                    for _ in range(n):
                        session = models.InteractiveSession.query.filter_by(
                            project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
                        ).one_or_none()
                        # The session has been deleted because the
                        # launch failed or because of another failure
                        # reason.
                        if session is None:
                            return
                        # We have to rely on the container ids and not
                        # on status because a session that is STOPPED
                        # while LAUNCHING will never reach a RUNNING
                        # state because the background task will
                        # explicitly avoid doing so.
                        if session.container_ids is not None:
                            container_ids = session.container_ids
                            notebook_server_info = session.notebook_server_info
                            break
                        # Otherwise we will get an old version of
                        # the session data.
                        db.session.close()
                        time.sleep(1)

                session_obj = InteractiveSession.from_container_IDs(
                    docker_client,
                    container_IDs=container_ids,
                    network=_config.DOCKER_NETWORK,
                    notebook_server_info=notebook_server_info,
                )

                # TODO: error handling?
                session_obj.shutdown()

                # Deletion happens here and not in the transactional
                # phase because this way we can show the session
                # STOPPING to the user.
                models.InteractiveSession.query.filter_by(
                    project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
                ).delete()
                db.session.commit()
            except Exception as e:
                current_app.logger.error(e)

                # Make sure that the session is deleted in any case,
                # because otherwise the user will not be able to have an
                # active session for the given pipeline.
                session = models.InteractiveSession.query.filter_by(
                    project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
                ).one()
                db.session.delete(session)
                db.session.commit()

    def _collateral(
        self,
        project_uuid: str,
        pipeline_uuid: str,
        container_ids: Dict[str, str],
        notebook_server_info: Dict[str, str],
        previous_state: str,
    ):
        # Could be none when the _transaction call sets them to None
        # because there is no session to shutdown. This is a way that
        # the _transaction function effectively tells the _collateral
        # function to not be run.
        if project_uuid is None or pipeline_uuid is None:
            return

        current_app.config["SCHEDULER"].add_job(
            StopInteractiveSession._background_session_stop,
            args=[
                current_app._get_current_object(),
                project_uuid,
                pipeline_uuid,
                container_ids,
                notebook_server_info,
                previous_state,
            ],
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
            self.collateral_kwargs["container_ids"] = None
            self.collateral_kwargs["notebook_server_info"] = None
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

            self.collateral_kwargs["container_ids"] = session.container_ids
            self.collateral_kwargs[
                "notebook_server_info"
            ] = session.notebook_server_info

        return True

    def _collateral(
        self,
        container_ids: Dict[str, str],
        notebook_server_info: Dict[str, str] = None,
    ):
        if container_ids is None:
            return

        session_obj = InteractiveSession.from_container_IDs(
            docker_client,
            container_IDs=container_ids,
            network=_config.DOCKER_NETWORK,
            notebook_server_info=notebook_server_info,
        )

        # Note: The entry in the database does not have to be updated
        # since restarting the `memory-server` does not change its
        # Docker ID.
        session_obj.restart_resource(resource_name="memory-server")
