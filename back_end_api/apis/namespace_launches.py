import json
import requests

from flask_restplus import Namespace, Resource, fields

from jupyterlab.labapp import LabApp


# Set namespace.
api = Namespace('launches', description='Launches of pipelines for development')

# Models.
server = api.model('Server', {
    'url': fields.String(required=True, description='URL of the server'),
    'hostname': fields.String(required=True, default='localhost', description='Hostname'),
    'port': fields.Integer(required=True, description='Port to access the server'),
    'secure': fields.Boolean(required=True, description='Any extra security measures'),
    'base_url': fields.String(required=True, default='/', description='Base URL'),
    'token': fields.String(required=True, description='Token for authentication'),
    'notebook_dir': fields.String(required=True, description='Directory of the server'),
    'password': fields.Boolean(required=True, description='Password if one is set'),
    'pid': fields.Integer(required=True, description='PID'),
})

launch = api.model('Launch', {
    'uuid': fields.Integer(required=True, description='UUID for Pipeline'),
    'pipeline-id': fields.Integer(required=True, description='Name of Pipeline'),
    'server-info': fields.Nested(server, required=True)
})

launches = api.model('Launches', {
    'launches': fields.List(fields.Nested(launch), description='Currently running launches')
})

# Launch instances.
LAUNCHES = []


@api.route('/')
class LaunchList(Resource):
    @api.marshal_with(launches)
    def get(self):
        """Fetch all launches."""
        pass

    @api.doc('launch_pipeline')
    @api.marshal_with(launch)
    def post(self):
        """Launch a pipeline for development."""
        # --no-browser
        # --ip
        # --port
        # --gateway-url
        # --notebook-dir

        # Runs the appropriate docker containers
        # * Jupyter Server
        # * Enterprise Gateway if one does not already exist

        r = requests.post('http://localhost:5000/api/servers/')
        print(r.json())

        launch = {'uuid': 1, 'pipeline-id': 11, 'server-info': r.json()}
        LAUNCHES.append(launch)

        return launch


@api.route('/<int:uuid>')
@api.param('uuid', 'UUID for Launch')
@api.response(404, 'Launch not found')
class Launch(Resource):
    @api.doc('get_launch')
    @api.marshal_with(launch)
    def get(self, uuid):
        """Fetch a launch given its UUID."""
        # Returns the JupyterLab server to which databoost should connect.
        # Use databoost jupyter API
        for launch in LAUNCHES:
            if launch['uuid'] == uuid:
                return launch

        api.abort(404)

    @api.doc('shutdown_launch')
    def delete(self, uuid):
        """Shutdown launch"""
        global LAUNCHES
        # Use Jupyter server API from databoost.
        for launch in LAUNCHES:
            if launch['uuid'] == uuid:
                requests.delete('http://localhost:5000/api/servers/')

                # TODO: correct item from launches should be deleted.
                LAUNCHES = []
                return {'message': 'Successful shutdown'}

        api.abort(404)
