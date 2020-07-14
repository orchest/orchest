from datetime import datetime

from celery.task.control import revoke
from flask import current_app, request
from flask_restplus import Namespace, Resource

from app.celery_app import make_celery
from app.connections import db
from app.core.pipelines import construct_pipeline
import app.models as models
from app.schema import (
    pipeline_run,
    pipeline_run_config,
    pipeline_run_spec,
    pipeline_runs,
    pipeline_step,
    status_update,
)


api = Namespace('runs', description='Managing (partial) runs')

api.models[pipeline_run.name] = pipeline_run
api.models[pipeline_run_config.name] = pipeline_run_config
api.models[pipeline_run_spec.name] = pipeline_run_spec
api.models[pipeline_runs.name] = pipeline_runs
api.models[pipeline_step.name] = pipeline_step
api.models[status_update.name] = status_update


@api.route('/')
class RunList(Resource):
    @api.doc('get_runs')
    @api.marshal_with(pipeline_runs)
    def get(self):
        """Fetch all runs.

        Either in the queue, running or already completed.
        """
        runs = models.Run.query.all()
        return {'runs': [run.as_dict() for run in runs]}, 200

    @api.doc('start_run')
    @api.expect(pipeline_run_spec)
    @api.marshal_with(pipeline_run, code=201, description='Run started')
    def post(self):
        """Start a new run."""
        post_data = request.get_json()
        post_data['run_config']['run_endpoint'] = 'runs'

        pipeline = construct_pipeline(**post_data)

        # Create Celery object with the Flask context and construct the
        # kwargs for the job.
        celery = make_celery(current_app)
        celery_job_kwargs = {
            'pipeline_description': pipeline.to_dict(),
            'run_config': post_data['run_config'],
        }

        # Start the run as a background task on Celery. Due to circular
        # imports we send the task by name instead of importing the
        # function directly.
        res = celery.send_task('app.core.tasks.run_partial',
                               kwargs=celery_job_kwargs)

        # NOTE: this is only if a backend is configured.  The task does
        # not return anything. Therefore we can forget its result and
        # make sure that the Celery backend releases recourses (for
        # storing and transmitting results) associated to the task.
        # Uncomment the line below if applicable.
        # res.forget()

        # NOTE: we are setting the status of the run ourselves without
        # using the option of celery to get the status of tasks. This
        # way we do not have to configure a backend (where the default
        # of "rpc://" does not give the results we would want).
        run = {
           'run_uuid': res.id,
           'pipeline_uuid': pipeline.properties['uuid'],
           'status': 'PENDING',
        }
        db.session.add(models.Run(**run))

        # Set an initial value for the status of the pipline steps that
        # will be run.
        step_uuids = [s.properties['uuid'] for s in pipeline.steps]

        step_statuses = []
        for step_uuid in step_uuids:
            step_statuses.append(models.StepStatus(**{
                'run_uuid': res.id,
                'step_uuid': step_uuid,
                'status': 'PENDING'
            }))
        db.session.bulk_save_objects(step_statuses)

        db.session.commit()

        run['step_statuses'] = step_statuses
        return run, 201


@api.route('/<string:run_uuid>')
@api.param('run_uuid', 'UUID for Run')
@api.response(404, 'Run not found')
class Run(Resource):
    @api.doc('get_run')
    @api.marshal_with(pipeline_run, code=200)
    def get(self, run_uuid):
        """Fetch a run given its UUID."""
        run = models.Run.query.get_or_404(run_uuid, description='Run not found')
        return run.__dict__

    @api.doc('set_run_status')
    @api.expect(status_update)
    def put(self, run_uuid):
        """Set the status of a run."""
        post_data = request.get_json()

        res = models.Run.query.filter_by(run_uuid=run_uuid).update({
            'status': post_data['status']
        })

        if res:
            db.session.commit()

        return {'message': 'Status was updated successfully'}, 200

    @api.doc('delete_run')
    @api.response(200, 'Run terminated')
    def delete(self, run_uuid):
        """Stop a run given its UUID."""
        # TODO: we could specify more options when deleting the run.
        # TODO: error handling.
        # TODO: possible set status of steps and Run to "REVOKED"

        # NOTE: The terminate option is a last resort for administrators
        # when a task is stuck. It’s not for terminating the task, it’s
        # for terminating the process that’s executing the task, and
        # that process may have already started processing another task
        # at the point when the signal is sent, so for this reason you
        # must never call this programmatically.
        revoke(run_uuid)

        return {'message': 'Run termination was successful'}, 200


@api.route('/<string:run_uuid>/<string:step_uuid>',
           doc={'description': 'Set and get execution status of steps.'})
@api.param('run_uuid', 'UUID for Run')
@api.param('step_uuid', 'UUID of Pipeline Step')
@api.response(404, 'Pipeline step not found')
class StepStatus(Resource):
    @api.doc('get_step_status')
    @api.marshal_with(pipeline_step, code=200)
    def get(self, run_uuid, step_uuid):
        """Fetch a step of a given run given their ids."""
        # TODO: Returns the status and logs. Of course logs are empty if
        #       the step is not executed yet.
        step = models.StepStatus.query.get_or_404(
            ident=(run_uuid, step_uuid),
            description='Run and step combination not found'
        )
        return step.__dict__

    @api.doc('set_step_status')
    @api.expect(status_update)
    def put(self, run_uuid, step_uuid):
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
        data = post_data
        if data['status'] == 'STARTED':
            data['started_time'] = datetime.fromisoformat(data['started_time'])
        elif data['status'] in ['SUCCESS', 'FAILURE']:
            data['ended_time'] = datetime.fromisoformat(data['ended_time'])

        res = models.StepStatus.query.filter_by(
            run_uuid=run_uuid, step_uuid=step_uuid
        ).update(data)

        if res:
            db.session.commit()

        return {'message': 'Status was updated successfully'}, 200
