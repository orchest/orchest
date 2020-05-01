from datetime import datetime

from celery.task.control import revoke
from flask import current_app, request
from flask_restplus import Namespace, Resource, fields

from app.connections import db
import app.models as models
from app.celery import make_celery


api = Namespace('runs', description='Managing (partial) runs')

step_status = api.model('Pipeline Step', {
    'run_uid': fields.String(
        required=True,
        description='UID for run'),
    'step_uuid': fields.String(
        required=True,
        description='UUID of a pipeline step'),
    'status': fields.String(
        required=True,
        description='Status of the step',
        enum=['PENDING', 'STARTED', 'SUCCESS', 'FAILURE', 'REVOKED']),
    'started_time': fields.String(
        required=True,
        description='Time at which the step was started'),
})

status_update = api.model('Status Update', {
    'status': fields.String(
        required=True,
        description='New status of the step',
        enum=['PENDING', 'STARTED', 'SUCCESS', 'FAILURE', 'REVOKED']),
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

run = api.model('Run', {
    'run_uid': fields.String(
        required=True,
        description='UID for run'),
    'pipeline_uuid': fields.String(
        required=True,
        description='UUID of a pipeline step'),
    'status': fields.String(
        required=True,
        description='Status of the run'),
    'step_statuses': fields.List(
        fields.Nested(step_status),
        description='Status of each pipeline step')
})

runs = api.model('Runs', {
    'runs': fields.List(fields.Nested(run), description='Ran and running tasks')
})


@api.route('/')
class RunList(Resource):
    @api.doc('get_runs')
    @api.marshal_with(runs)
    def get(self):
        """Fetch all runs.

        Either in the queue, running or already completed.
        """
        runs = models.Run.query.all()
        return {'runs': [run.as_dict() for run in runs]}, 200

    @api.doc('start_run')
    @api.expect(run_configuration)
    @api.marshal_with(run, code=201, description='Run started')
    def post(self):
        """Start a new run."""
        post_data = request.get_json()

        # Create Celery object with the Flask context.
        celery = make_celery(current_app)

        # Start the run as a background task on Celery. Due to circular
        # imports we send the task by name instead of importing the
        # function directly.
        res = celery.send_task('app.core.runners.run_partial', kwargs=post_data)

        # NOTE: this is only if a backend is configured.
        # The task does not return anything. Therefore we can forget its
        # result and make sure that the Celery backend releases recourses
        # (for storing and transmitting results) associated to the task.
        # res.forget()

        # NOTE: we are setting the status of the run ourselves without
        # using the option of celery to get the status of tasks. This way
        # we do not have to configure a backend (where the default of
        # "rpc://" does not give the results we would want).
        run = {
           'run_uid': res.id,
           'pipeline_uuid': post_data['pipeline_description']['uuid'],
           'status': 'PENDING',
        }
        db.session.add(models.Run(**run))

        # Set an initial value for the status of the pipline steps.
        step_statuses = []
        for step_uuid in post_data['pipeline_description']['steps']:
            step_statuses.append(models.StepStatus(**{
                'run_uid': res.id,
                'step_uuid': step_uuid,
                'status': 'PENDING'
            }))
        db.session.bulk_save_objects(step_statuses)

        db.session.commit()

        run['step_statuses'] = step_statuses
        return run, 201


@api.route('/<string:run_uid>')
@api.param('run_uid', 'UID for Run')
@api.response(404, 'Run not found')
class Run(Resource):
    @api.doc('get_run')
    @api.marshal_with(run, code=200)
    def get(self, run_uid):
        """Fetch a run given its UID."""
        run = models.Run.query.get_or_404(run_uid, description='Run not found')

        # TODO: we probably want to use this __dict__ for other models
        #       as well.
        return run.__dict__

    @api.doc('set_run_status')
    @api.expect(status_update)
    def put(self, run_uid):
        """Set the status of a run."""
        post_data = request.get_json()

        res = models.Run.query.filter_by(run_uid=run_uid).update({
            'status': post_data['status']
        })

        if res:
            db.session.commit()

        return {'message': 'Status was updated successfully'}, 200

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
    @api.marshal_with(step_status, code=200)
    def get(self, run_uid, step_uuid):
        """Fetch a step of a given run given their ids."""
        # TODO: Returns the status and logs. Of course logs are empty if the
        # step is not executed yet.
        step = models.StepStatus.query.get_or_404(
                            ident=(run_uid, step_uuid),
                            description='Run and step combination not found')
        return step.__dict__

    @api.doc('set_step_status')
    @api.expect(status_update)
    def put(self, run_uid, step_uuid):
        """Set the status of a step."""
        post_data = request.get_json()

        # TODO: don't we want to do this async? Since otherwise the API
        #       call might be blocking another since they both execute
        #       on the database? SQLite can only have one process write
        #       to the db. If this becomes an issue than we could also
        #       use an in-memory db (since that is a lot faster than
        #       disk). Otherwise we might have to use PostgreSQL.
        # TODO: first check the status and make sure it says PENDING or
        #       whatever. Because if is empty then this would write it
        #       and then get overwritten afterwards with "PENDING".
        # TODO: Obviously this is not the most correct place to set the
        #       time of when the task has started. This should be done
        #       in the app.core.runners when the self._status is set to
        #       STARTED.
        update_data = post_data
        if update_data['status'] == 'STARTED':
            update_data['started_time'] = datetime.utcnow()

        res = models.StepStatus.query.filter_by(
            run_uid=run_uid, step_uuid=step_uuid
        ).update(update_data)

        if res:
            db.session.commit()

        return {'message': 'Status was updated successfully'}, 200
