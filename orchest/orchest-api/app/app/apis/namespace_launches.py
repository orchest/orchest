import logging
import sys

from flask import request
from flask_restplus import Namespace
from flask_restplus import Resource

from app.connections import db, docker_client
from app.core.sessions import InteractiveSession
import app.models as models
from app.schema import server, launch, launches, pipeline


logging.basicConfig(stream=sys.stdout, level=logging.INFO)

api = Namespace('launches', description='Launches of pipelines for development')

api.models[server.name] = server
api.models[launch.name] = launch
api.models[launches.name] = launches
api.models[pipeline.name] = pipeline


@api.route('/')
class LaunchList(Resource):
    @api.doc('fetch_launches')
    @api.marshal_with(launches)
    def get(self):
        """Fetch all launches."""
        query = models.Launch.query

        if "pipeline_uuid" in request.args:
            query = query.filter_by(pipeline_uuid=request.args.get('pipeline_uuid'))

        launches = query.all()

        return {'launches': [launch.as_dict() for launch in launches]}, 200

    # TODO: create new schema. Maybe nice to not include the IDs in the
    #       schema as it does not matter to the front-end. Should be
    #       done automatically through the marshel_with. Note that the
    #       attr server_ip is not jupyter_server_ip etc.
    @api.doc('launch_pipeline')
    @api.expect(pipeline)
    @api.marshal_with(launch, code=201, description='Pipeline launched')
    def post(self):
        """Launch a pipeline for development."""
        post_data = request.get_json()

        session = InteractiveSession(docker_client, network='orchest')
        session.launch(post_data['pipeline_uuid'], post_data['pipeline_dir'])

        IP = session.get_containers_IP()
        container_ids = session.get_container_IDs()
        interactive_session = {
            'pipeline_uuid': post_data['pipeline_uuid'],
            'jupyter_server_ip': IP.jupyter_server,
            'notebook_server_info': session.notebook_server_info,
        }
        interactive_session.update(container_ids)
        db.session.add(models.InteractiveSession(**interactive_session))
        db.session.commit()

        return interactive_session, 201


@api.route('/<string:pipeline_uuid>')
@api.param('pipeline_uuid', 'UUID of pipeline')
@api.response(404, 'Launch not found')
class Launch(Resource):
    """Launched pipelines for development.

    Individual pipelines can only be launched once, therefore the UUID
    of a pipeline also uniquely identifies a launch.
    """
    @api.doc('get_launch')
    @api.marshal_with(launch)
    def get(self, pipeline_uuid):
        """Fetch a launch given its UUID."""
        session = models.InteractiveSession.query.get_or_404(
            pipeline_uuid, description='Launch not found'
        )
        return session.as_dict()

    @api.doc('shutdown_launch')
    @api.response(200, 'Launch stopped')
    @api.response(404, 'Launch not found')
    def delete(self, pipeline_uuid):
        """Shutdown launch"""
        session = models.InteractiveSession.query.get_or_404(
            pipeline_uuid, description='Launch not found'
        )

        # TODO: if possible the db should contain a column where all its
        #       entries are mappings containing all the resources's
        #       container ids.
        ids = {
            'memory-server': session.memory_server,
            'jupyter-server': session.jupyter_server,
            'jupyter-EG': session.jupyter_EG,
        }
        session_obj = InteractiveSession.from_container_IDs(
            docker_client,
            container_IDs=ids,
            network='orchest',
        )

        # TODO: error handling?
        session_obj.shutdown()

        db.session.delete(session)
        db.session.commit()

        return {'message': 'Session shutdown was successful'}, 200
