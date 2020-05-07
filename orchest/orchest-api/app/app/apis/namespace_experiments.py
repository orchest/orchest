from flask_restplus import Namespace, Resource, fields


api = Namespace('experiments', description='Managing experiments')

experiment = api.model('Experiment', {
    'id': fields.Integer(required=True, description='UUID for Experiment')
})

# TODO: everything. Currently just a placeholder for the api namespace.


@api.route('/')
class ExperimentList(Resource):
    def get(self):
        """Fetch all experiments."""
        pass

    def post(self):
        """Start a new experiment."""
        pass


@api.route('/<int:uuid>')
@api.param('uuid', 'UUID for Experiment')
@api.response(404, 'Experiment not found')
class Experiment(Resource):
    @api.doc('get_experiment')
    def get(self, uuid):
        """Fetch an experiment given its UUID."""
        pass
