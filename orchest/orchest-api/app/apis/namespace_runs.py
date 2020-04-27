from celery.task.control import revoke
from flask import current_app, request
from flask_restplus import Namespace, Resource, fields

from app.connections import db
import app.models as models
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
        description='Type of run',
        enum=['full', 'selection', 'incoming']),
    'pipeline_description': fields.Raw(
        required=True,
        description='Pipeline definition in JSON')
})

# TODO: see celery states.
step_status_update = api.model('Step Status Update', {
    'status': fields.String(
        required=True,
        description='New status of the step',
        enum=['PENDING', 'STARTED', 'SUCCESS']),
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

        # TODO: it is vital! that this addition to the dataset gets run
        #       before the status of the steps are updated by the Celery
        #       task (which is also done via the API).
        run = {
           'run_uid': res.id,
           'pipeline_uuid': post_data['pipeline_description']['uuid'],
           'status': res.state,
        }

        # TODO: write to the StepStatus an initial default empty values.

        db.session.add(models.Run(**run))
        db.session.commit()

        return run, 201


@api.route('/<string:run_uid>')
@api.param('run_uid', 'UID for Run')
@api.response(404, 'Run not found')
class Run(Resource):
    @api.doc('get_run')
    @api.marshal_with(run, code=200)
    def get(self, run_uid):
        """Fetch a run given its UID."""
        run = models.Run.query.filter_by(run_uid=run_uid).first_or_404(
                description='Run not found'
        )
        return run.as_dict()

    @api.doc('delete_run')
    @api.response(200, 'Run terminated')
    def delete(self, run_uid):
        """Stop a run given its UID."""
        # TODO: we could specify more options when deleting the run.
        # TODO: error handling.

        # TODO: possible set status of steps and Run to "REVOKED"
        # Stop the run, whether it is in the queue or whether it is
        # actually running.
        revoke(run_uid, terminate=True)

        return {'message': 'Run termination was successful'}, 200


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
        step = models.StepStatus.query.filter_by(
                run_uid=run_uid, step_uuid=step_uuid
        ).first_or_404(description='Run and step combination not found')
        return step.as_dict()

    # TODO: make into update. It should by default populate the db with all
    #       the steps and set their status to PENDING or whatever default
    #       value.
    @api.doc('set_step_status')
    @api.expect(step_status_update)
    def put(self, run_uid, step_uuid):
        """Set the status of a step."""
        post_data = request.get_json()

        # TODO: don't we want to do this async? Since otherwise the API
        #       call might be blocking another since they both execute
        #       on the database?
        # TODO: first check the status and make sure it says PENDING or
        #       or whatever. Because it is empty then this would write it
        #       and then get overwritten.
        # TODO: maybe set synchorinze_session kwarg for update.
        res = models.StepStatus.query.filter_by(
            run_uid=run_uid, step_uuid=step_uuid
        ).update({'status': post_data['status']})

        if res:
            db.session.commit()

        return {'message': 'Status was updated successfully'}, 200
