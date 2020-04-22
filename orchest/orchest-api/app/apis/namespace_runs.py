from flask import request
from flask_restplus import Namespace, Resource, fields


api = Namespace('runs', description='Managing (partial) runs')

pipeline_step = api.model('Pipeline Step', {
    'uuid': fields.Integer(required=True, description='UUID of a pipeline step'),
    'status': fields.String(required=True, description='Status of the step'),
})

run = api.model('Run', {
    'uid': fields.Integer(required=True, description='UID for run'),
    'status': fields.String(required=True, description='Status of the run'),
    'step-status': fields.List(fields.Nested(pipeline_step),
                               description='Status of each pipeline steps')
})

run_configuration = api.model('Run Configuration', {
    'uuids': fields.List(fields.String(),
                         required=False,
                         description='UUIDs of pipeline steps'),
    'run-type': fields.String(required=True,
                              description='Status of the step',
                              enum=['full', 'selection', 'incoming']),
})


@api.route('/')
class RunList(Resource):
    @api.doc('get_runs')
    def get(self):
        """Fetch all running runs and runs currently in the queue."""
        # Return a list of all Task ids that are either in the queue or
        # running.
        pass

    @api.doc('start_run')
    @api.expect(run_configuration)
    @api.marshal_with(run, code=201, description='Run started')
    def post(self):
        """Start a new run."""
        # Start a new run, need to get list of UUIDs and either one of
        # ("full", "selection", "incoming")
        post_data = request.get_json()
        return


@api.route('/<int:uid>')
@api.param('uid', 'UID for Run')
@api.response(404, 'Run not found')
class Run(Resource):
    @api.doc('get_run')
    def get(self, uid):
        """Fetch a run given its UID."""
        # Return the status of the Task, and the status of all the steps.
        # if task.status == DONE then all steps are also DONE
        # if task.status == PENDING then all steps are also PENDING (queue)
        # if task.status == RUNNING then the steps could all have different status.

        # The status from the steps is stored in some in-memory-store
        # (could be redis or aiosqlite). Note that it has to be done
        # async. Since the containers of the steps are also run async.
        pass

    @api.doc('delete_run')
    def delete(self, uid):
        """Stop a run given its UID."""
        # Stop the run, whether it is in the queue or whether it is
        # actually running.
        pass


# TODO: could also include the path /runs/{uid}/pipeline-step/{uuid} to
#       get the status of the specific step.
