from flask_restplus import Namespace, Resource, fields


api = Namespace('pipelines', description='Managing pipelines')

pipeline = api.model('Pipeline', {
    'uuid': fields.Integer(required=True, description='UUID for Pipeline'),
    'name': fields.String(required=False, description='Name of Pipeline')
})

# TODO: should probably be some db or something with the directory
#       files.
PIPELINES = [
    {'uuid': 1, 'name': 'pipeline-1'}
]


@api.route('/')
class PipelineList(Resource):
    def get(self):
        """Fetch all pipelines."""
        pass

    def post(self):
        """Add a new pipeline."""
        pass


@api.route('/<int:uuid>')
@api.param('uuid', 'UUID for Pipeline')
@api.response(404, 'Pipeline not found')
class Pipeline(Resource):
    @api.doc('get_pipeline')
    @api.marshal_with(pipeline)
    def get(self, uuid):
        """Fetch a pipeline given its UUID."""
        for pipeline in PIPELINES:
            if pipeline['uuid'] == uuid:
                return pipeline
        api.abort(404)

    def put(self):
        """Update pipeline."""
        # For example when a new step is added, or the order of steps is changed.
        pass

    def delete(self):
        """Delete pipeline."""
        pass


@api.route('/<int:pipeline_uuid>/step/<int:step_uuid>')
@api.param('pipeline_uuid', 'UUID for pipeline')
@api.param('step_uuid', 'UUID for step')
class PipelineStep(Resource):
    def get(self):
        """Fetch step of specific pipeline."""
        pass

    def post(self):
        """Create new step."""
        pass

    def put(self):
        """Update pipeline step."""
        pass

    def delete(self):
        """Delete pipeline step."""
        pass
