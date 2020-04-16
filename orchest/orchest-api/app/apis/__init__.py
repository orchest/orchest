from flask import Blueprint
from flask_restplus import Api

from app.apis.namespace_experiments import api as ns_experiments
from app.apis.namespace_launches import api as ns_launches


blueprint = Blueprint('api', __name__)

api = Api(
    blueprint,
    title='Orchest API',
    version='1.0',
    description='Back-end API for orchest'
)

api.add_namespace(ns_experiments)
api.add_namespace(ns_launches)
