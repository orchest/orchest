import asyncio
import json
import requests
import subprocess
import time

from flask_restplus import Namespace, Resource, fields


api = Namespace('servers', description='Start and stop Jupyter servers')

server = api.model('Launch', {
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

SERVER = None


@api.route('/')
@api.response(404, 'Launch not found')
class Server(Resource):
    @api.doc('get_launch')
    @api.marshal_with(server)
    def get(self):
        """Fetch the server information if it is running."""
        global SERVER
        if SERVER is not None:
            return SERVER

        return {'message': 'No currently running server'}, 404

    # TODO: add arguments to the post for notebook-dir etc.
    @api.doc('start_server')
    def post(self):
        """Start a Jupyter server."""
        # Need to start a new event loop to start a subprocess.
        asyncio.set_event_loop(asyncio.new_event_loop())

        # Start a Jupyter server within a subprocess.  The "-u" option
        # is to avoid buffering. Since it will be a long running
        # process, we want output whilst the program is running such
        # that we know when and if the server did successfully start.
        proc = subprocess.Popen(args=['python', '-u', 'core/start_server.py'],
                                stdout=subprocess.PIPE)

        # Wait for the server to be booted, it will write a message to
        # stdout once successful.
        _ = proc.stdout.readline()

        # Get the information to connect to the server.
        with open('tmp/server_info.json', 'r') as f:
            info = json.load(f)

        global SERVER
        SERVER = info

        return {'message': 'successful launch', 'info': info}

    @api.doc('shutdown_server')
    def delete(self):
        """Shutdown Jupyter server."""
        global SERVER

        # Send an authenticated POST request to the <server_url>/api/shutdown
        # Authentication is done via the token of the server.
        token = SERVER['token']
        headers = {'Authorization': f'Token {token}'}

        # The server's url already contains a trailing slash.
        server_url = SERVER['url']
        url = f'{server_url}api/shutdown'

        # Shutdown the server, such that it also shuts down all related
        # kernels.
        requests.post(url, headers=headers)

        # There no longer is a running server.
        SERVER = None

        return {'message': 'Server shutdown was successful'}
