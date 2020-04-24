from flask import current_app, request
from flask_restplus import Namespace, Resource, fields

from app.connections import db
import app.models as models
# from app.core.runners import run_partial
from app.celery import make_celery


api = Namespace('runs', description='Managing (partial) runs')

pipeline_step = api.model('Pipeline Step', {
    'uuid': fields.String(required=True, description='UUID of a pipeline step'),
    'status': fields.String(required=True, description='Status of the step'),
})

run = api.model('Run', {
    'run_uid': fields.String(required=True, description='UID for run'),
    'pipeline_uuid': fields.String(required=True, description='UUID of a pipeline step'),
    'status': fields.String(required=True, description='Status of the run'),
    'step_statuses': fields.List(fields.Nested(pipeline_step),
                               description='Status of each pipeline step')
})

runs = api.model('Runs', {
    'runs': fields.List(fields.Nested(run), description='Ran and running tasks')
})

run_configuration = api.model('Run Configuration', {
    'uuids': fields.List(
        fields.String(),
        required=False,
        description='UUIDs of pipeline steps'),
    'run_type': fields.String(
        required=True,
        description='Status of the step',
        enum=['full', 'selection', 'incoming']),
    'pipeline_description': fields.Raw(
        required=True,
        description='Pipeline definition in JSON')
})


@api.route('/')
class RunList(Resource):
    @api.doc('get_runs')
    @api.marshal_with(runs)
    def get(self):
        """Fetch all runs.

        Either in the queue, running or already completed.
        """
        # Return a list of all Task ids that are either in the queue or
        # running.
        runs = models.Runs.query.all()
        return {'runs': [run.as_dict() for run in runs]}, 200

    @api.doc('start_run')
    @api.expect(run_configuration)
    @api.marshal_with(run, code=201, description='Run started')
    def post(self):
        """Start a new run."""
        post_data = request.get_json()

        # Create Celery object with the Flask context.
        celery = make_celery(current_app)

        # Start the run as a background task on Celery.
        # res = run_partial.delay(**post_data)
        res = celery.send_task('app.core.runners.run_partial', kwargs=post_data)

        # NOTE: this is only if a backend is configured.
        # The task does not return anything. Therefore we can forget its
        # result and make sure that the Celery backend releases recourses
        # (for storing and transmitting results) associated to the task.
        # res.forget()

        run = {
           'run_uid': res.id,
           'pipeline_uuid': post_data['pipeline_description']['uuid'],
           'status': res.state,
        }
        db.session.add(models.Run(**run))
        db.session.commit()

        return run, 201


@api.route('/<string:uid>')
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


# TODO: check what it should return. Everything about the step? Or just
#       the status?
@api.route('/<string:run_uid>/<string:step_uuid>',
           doc={'description': 'Set and get execution status of steps.'})
@api.param('run_uid', 'UID for Run')
@api.param('step_uuid', 'UUID of Pipeline Step')
@api.response(404, 'Pipeline step not found')
class StepStatus(Resource):
    @api.doc('get_step_status')
    def get(self, run_uid, step_uuid):
        """Fetch a step of a given run given their ids."""
        # Returns the status and logs. Of course logs are empty if the
        # step is not executed yet.
        pass

    @api.doc('set_step_status')
    def post(self, run_uid, step_uuid):
        """Set the status of a step."""
        # launch = {
        #     'pipeline_uuid': post_data['pipeline_uuid'],
        #     'server_ip': IP.server,
        #     'server_info': r.json()
        # }
        # db.session.add(models.Launch(**launch))
        # db.session.commit()
        pass
