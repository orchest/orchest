from flask import Blueprint
from flask_restplus import Api

from app.apis.namespace_servers import api as ns_servers


blueprint = Blueprint('api', __name__)

api = Api(
    blueprint,
    title='Orchest - jupyter-server API',
    version='1.0',
    description='Start and shutdown (a single) Jupyter server'
)

api.add_namespace(ns_servers)
