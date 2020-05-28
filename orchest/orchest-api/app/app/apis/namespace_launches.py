import logging
import sys
import time


from flask import request
from flask_restplus import fields
from flask_restplus import Namespace
from flask_restplus import Resource
import requests

from app.connections import db, docker_client
from app.core.managers import JupyterDockerManager
import app.models as models


logging.basicConfig(stream=sys.stdout, level=logging.INFO)

api = Namespace('launches', description='Launches of pipelines for development')

# Models for RESTful API.
server = api.model('Server', {
    'url': fields.String(
        required=True,
        description='URL of the server'),
    'hostname': fields.String(
        required=True,
        default='localhost',
        description='Hostname'),
    'port': fields.Integer(
        required=True,
        default=8888,
        description='Port to access the server'),
    'secure': fields.Boolean(
        required=True,
        description='Any extra security measures'),
    'base_url': fields.String(
        required=True,
        default='/',
        description='Base URL'),
    'token': fields.String(
        required=True,
        description='Token for authentication'),
    'notebook_dir': fields.String(
        required=True,
        default='/notebooks',
        description='Working directory'),
    'password': fields.Boolean(
        required=True,
        description='Password if one is set'),
    'pid': fields.Integer(
        required=True,
        description='PID'),
})

launch = api.model('Launch', {
    'pipeline_uuid': fields.String(
        required=True,
        description='UUID of pipeline'),
    'server_ip': fields.String(
        required=True,
        description='IP of the Jupyter server'),
    'server_info': fields.Nested(
        server,
        required=True,
        description='Jupyter connection info')
})

launches = api.model('Launches', {
    'launches': fields.List(
        fields.Nested(launch),
        description='Currently running launches')
})

pipeline = api.model('Pipeline', {
    'pipeline_uuid': fields.String(
        required=True,
        description='UUID of pipeline'),
    'pipeline_dir': fields.String(
        required=True,
        description='Path to pipeline files')
})


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

    @api.doc('launch_pipeline')
    @api.expect(pipeline)
    @api.marshal_with(launch, code=201, description='Pipeline launched')
    def post(self):
        """Launch a pipeline for development."""
        post_data = request.get_json()

        jdm = JupyterDockerManager(docker_client, network='orchest')
        IP = jdm.launch_pipeline(post_data['pipeline_uuid'],
                                 post_data['pipeline_dir'])

        # The launched jupyter-server container is only running the API
        # and waits for instructions before the Jupyter server is
        # started. Tries to start the Jupyter server, by waiting for the
        # API to be running after container launch.
        for i in range(10):
            try:
                logging.info('Starting Jupyter Server on %s with Enterprise '
                             'Gateway on %s' % (IP.server, IP.EG))

                # Starts the Jupyter server and connects it to the given
                # Enterprise Gateway.
                r = requests.post(
                        f'http://{IP.server}:80/api/servers/',
                        json={'gateway-url': f'http://{IP.EG}:8888',
                        'NotebookApp.base_url': f'/jupyter_{IP.server.replace(".", "_")}/'}
                )
            except requests.ConnectionError:
                # TODO: there is probably a robuster way than a sleep.
                #       Does the EG url have to given at startup? Because
                #       else we don't need a time-out and simply give it
                #       later.
                time.sleep(0.5)
            else:
                break

        launch = {
            'pipeline_uuid': post_data['pipeline_uuid'],
            'server_ip': IP.server,
            'server_info': r.json()
        }
        db.session.add(models.Launch(**launch))
        db.session.commit()

        return launch, 201


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
        launch = models.Launch.query.get_or_404(
            pipeline_uuid, description='Launch not found'
        )
        return launch.as_dict()

    @api.doc('shutdown_launch')
    @api.response(200, 'Launch stopped')
    @api.response(404, 'Launch not found')
    def delete(self, pipeline_uuid):
        """Shutdown launch"""
        launch = models.Launch.query.get_or_404(
            pipeline_uuid, description='Launch not found'
        )

        # Uses the API inside the container that is also running the
        # Jupyter server to shut the server down and clean all running
        # kernels that are associated with the server.
        requests.delete(f'http://{launch.server_ip}:80/api/servers/')

        # TODO: not sure whether the event of shutting down all the
        #       kernels has to be awaited or the docker containers can
        #       simply be shut down.

        jdm = JupyterDockerManager(docker_client, network='orchest')
        response = jdm.shutdown_pipeline(pipeline_uuid)

        if response is not None:
            api.abort(404)

        db.session.delete(launch)
        db.session.commit()

        return {'message': 'Server shutdown was successful'}, 200
