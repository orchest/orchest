import logging
import sys

from flask import request
from flask_restplus import Namespace
from flask_restplus import Resource

from app.connections import db, docker_client
from app.core.sessions import InteractiveSession
import app.models as models
from app.schema import server, session, sessions, pipeline


logging.basicConfig(stream=sys.stdout, level=logging.INFO)

api = Namespace('sessions', description='Manage interactive sessions')

api.models[server.name] = server
api.models[session.name] = session
api.models[sessions.name] = sessions
api.models[pipeline.name] = pipeline


@api.route('/')
class SessionList(Resource):
    @api.doc('fetch_sessions')
    @api.marshal_with(sessions)
    def get(self):
        """Fetches all sessions."""
        query = models.InteractiveSession.query

        if 'pipeline_uuid' in request.args:
            query = query.filter_by(pipeline_uuid=request.args.get('pipeline_uuid'))

        sessions = query.all()

        return {'sessions': [session.as_dict() for session in sessions]}, 200

    # TODO: create new schema. Maybe nice to not include the IDs in the
    #       schema as it does not matter to the front-end. Should be
    #       done automatically through the marshel_with. Note that the
    #       attr server_ip is not jupyter_server_ip etc.
    @api.doc('launch_session')
    @api.expect(pipeline)
    @api.marshal_with(session, code=201, description='Session launched.')
    def post(self):
        """Launches an interactive session."""
        post_data = request.get_json()

        session = InteractiveSession(docker_client, network='orchest')
        session.launch(post_data['pipeline_uuid'], post_data['pipeline_dir'])

        IP = session.get_containers_IP()
        interactive_session = {
            'pipeline_uuid': post_data['pipeline_uuid'],
            'container_ids': session.get_container_IDs(),
            'jupyter_server_ip': IP.jupyter_server,
            'notebook_server_info': session.notebook_server_info,
        }
        db.session.add(models.InteractiveSession(**interactive_session))
        db.session.commit()

        return interactive_session, 201


@api.route('/<string:pipeline_uuid>')
@api.param('pipeline_uuid', 'UUID of pipeline')
@api.response(404, 'Session not found')
class Session(Resource):
    """Manages interactive sessions.

    There can only be 1 interactive session per pipeline. Interactive
    sessions are uniquely identified by the pipeline's UUID.
    """
    @api.doc('get_session')
    @api.marshal_with(session)
    def get(self, pipeline_uuid):
        """Fetch a session given the pipeline UUID."""
        session = models.InteractiveSession.query.get_or_404(
            pipeline_uuid, description='Session not found.'
        )
        return session.as_dict()

    @api.doc('shutdown_session')
    @api.response(200, 'Session stopped')
    @api.response(404, 'Session not found')
    def delete(self, pipeline_uuid):
        """Shutdowns session."""
        session = models.InteractiveSession.query.get_or_404(
            pipeline_uuid, description='Session not found'
        )
        session_obj = InteractiveSession.from_container_IDs(
            docker_client,
            container_IDs=session.container_ids,
            network='orchest',
        )

        # TODO: error handling?
        session_obj.shutdown()

        db.session.delete(session)
        db.session.commit()

        return {'message': 'Session shutdown was successful'}, 200

    @api.doc('restart_memory_server_of_session')
    @api.response(200, 'Session resource memory-server restarted')
    @api.response(404, 'Session not found')
    def put(self, pipeline_uuid):
        """Restarts the memory-server of session."""
        session = models.InteractiveSession.query.get_or_404(
            pipeline_uuid, description='Session not found'
        )
        session_obj = InteractiveSession.from_container_IDs(
            docker_client,
            container_IDs=session.container_ids,
            network='orchest',
        )

        # NOTE: The entry in the database does not have to be updated
        # since restarting the `memory-server` does not change its
        # Docker ID.
        session_obj.restart_resource(resource_name='memory-server')

        return {'message': 'Session restart was successful'}, 200
