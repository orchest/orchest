from flask import request
from flask_restx import Namespace, Resource

import app.models as models
from _orchest.internals.two_phase_executor import TwoPhaseExecutor, TwoPhaseFunction
from app import schema
from app.connections import db, docker_client
from app.core.sessions import InteractiveSession
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
    @api.expect(schema.pipeline)
    @api.marshal_with(schema.session, code=201, description="Session launched.")
    def post(self):
        """Launches an interactive session."""
        post_data = request.get_json()

        try:
            with TwoPhaseExecutor(db.session) as tpe:
                CreateInteractiveSession(tpe).transaction(
                    post_data["project_uuid"],
                    post_data["pipeline_uuid"],
                    post_data["pipeline_path"],
                    post_data["project_dir"],
                    post_data["host_userdir"],
                )
        except Exception as e:
            return {"message": str(e)}, 500

        isess = models.InteractiveSession.query.filter_by(
            project_uuid=post_data["project_uuid"],
            pipeline_uuid=post_data["pipeline_uuid"],
        ).one_or_none()

        return isess.as_dict(), 201


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
            return {"message": "Session not found."}, 400

    @api.doc("restart_memory_server_of_session")
    @api.response(200, "Session resource memory-server restarted")
    @api.response(404, "Session not found")
    def put(self, project_uuid, pipeline_uuid):
        """Restarts the memory-server of the session."""
        session = models.InteractiveSession.query.get_or_404(
            ident=(project_uuid, pipeline_uuid), description="Session not found"
        )
        session_obj = InteractiveSession.from_container_IDs(
            docker_client,
            container_IDs=session.container_ids,
            network="orchest",
            notebook_server_info=session.notebook_server_info,
        )

        # Note: The entry in the database does not have to be updated
        # since restarting the `memory-server` does not change its
        # Docker ID.
        session_obj.restart_resource(resource_name="memory-server")

        return {"message": "Session restart was successful."}, 200


class CreateInteractiveSession(TwoPhaseFunction):
    def _transaction(
        self,
        project_uuid: str,
        pipeline_uuid: str,
        pipeline_path: str,
        project_dir: str,
        host_userdir: str,
    ):
        interactive_session = {
            "project_uuid": project_uuid,
            "pipeline_uuid": pipeline_uuid,
            "status": "LAUNCHING",
        }
        db.session.add(models.InteractiveSession(**interactive_session))

        self.collateral_kwargs["project_uuid"] = project_uuid
        self.collateral_kwargs["pipeline_uuid"] = pipeline_uuid
        self.collateral_kwargs["pipeline_path"] = pipeline_path
        self.collateral_kwargs["project_dir"] = project_dir
        self.collateral_kwargs["host_userdir"] = host_userdir

    def _collateral(
        self,
        project_uuid: str,
        pipeline_uuid: str,
        pipeline_path: str,
        project_dir: str,
        host_userdir: str,
    ):
        session = InteractiveSession(docker_client, network="orchest")
        session.launch(
            pipeline_uuid,
            project_uuid,
            pipeline_path,
            project_dir,
            host_userdir,
        )

        # Update the database entry with information to connect to the
        # launched resources.
        IP = session.get_containers_IP()
        status = {
            "status": "RUNNING",
            "container_ids": session.get_container_IDs(),
            "jupyter_server_ip": IP.jupyter_server,
            "notebook_server_info": session.notebook_server_info,
        }
        models.InteractiveSession.query.filter_by(
            project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
        ).update(status)
        db.session.commit()

    def _revert(self):
        # Error handling. If it does not succeed then the initial
        # entry has to be removed from the database as otherwise no
        # session can be started in the future due to the uniqueness
        # constraint.
        models.InteractiveSession.query.filter_by(
            project_uuid=self.collateral_kwargs["project_uuid"],
            pipeline_uuid=self.collateral_kwargs["pipeline_uuid"],
        ).delete()
        db.session.commit()


class StopInteractiveSession(TwoPhaseFunction):
    def _transaction(
        self,
        project_uuid: str,
        pipeline_uuid: str,
    ):

        session = models.InteractiveSession.query.filter_by(
            project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
        ).one_or_none()
        if session is None:
            self.collateral_kwargs["project_uuid"] = None
            self.collateral_kwargs["pipeline_uuid"] = None
            return False
        else:
            session.status = "STOPPING"
            self.collateral_kwargs["project_uuid"] = project_uuid
            self.collateral_kwargs["pipeline_uuid"] = pipeline_uuid
        return True

    def _collateral(self, project_uuid: str, pipeline_uuid: str):
        # Could be none when the _transaction call sets them to None
        # because there is no session to shutdown. This is a way that
        # the _transaction function effectively tells the _collateral
        # function to not be run.
        if not project_uuid or not pipeline_uuid:
            return

        session = models.InteractiveSession.query.filter_by(
            project_uuid=project_uuid, pipeline_uuid=pipeline_uuid
        ).one_or_none()
        if session is None:
            return

        session_obj = InteractiveSession.from_container_IDs(
            docker_client,
            container_IDs=session.container_ids,
            network="orchest",
            notebook_server_info=session.notebook_server_info,
        )

        # TODO: error handling?
        # TODO: If we can do this task in the background then the
        # request can return. The session shutting down should not
        # depend on the existence of the object in the DB. Need to make
        # sure if it is indeed possible, e.g. if there are no race
        # conditions when shutting down and starting another interactive
        # session at the same time.
        session_obj.shutdown()

        db.session.delete(session)
        db.session.commit()
