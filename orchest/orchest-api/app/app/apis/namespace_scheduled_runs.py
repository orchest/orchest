from datetime import datetime
import os
from shutil import copytree

from celery import uuid
from celery.task.control import revoke
from flask import current_app, request
from flask_restplus import Namespace, Resource

from app.celery_app import make_celery
from app.connections import db
from app.core.pipelines import construct_pipeline
from app.schema import (
    scheduled_run,
    scheduled_run_configuration,
    scheduled_runs,
    status_update,
    step_status,
)
import app.models as models


api = Namespace('scheduled_runs', description='Managing (partial) scheduled runs')

api.models[scheduled_run.name] = scheduled_run
api.models[scheduled_run_configuration.name] = scheduled_run_configuration
api.models[scheduled_runs.name] = scheduled_runs
api.models[status_update.name] = status_update
api.models[step_status.name] = step_status


@api.route('/')
class ScheduledRunList(Resource):
    @api.doc('get_scheduled_runs')
    @api.marshal_with(scheduled_runs)
    def get(self):
        """Fetch all scheduled runs.

        Either in the queue, running or already completed.
        """
        scheduled_runs = models.ScheduledRun.query.all()
        return {'scheduled_runs': [run.as_dict() for run in scheduled_runs]}, 200

    @api.doc('start_scheduled_run')
    @api.expect(scheduled_run_configuration)
    @api.marshal_with(scheduled_run, code=201, description='Scheduled Run Scheduled')
    def post(self):
        """Schedule a new run"""
        post_data = request.get_json()

        # Generates UUID for the run instead of having Celery generate
        # one, because we need it ahead of time to create the directory
        # on which the pipeline run will operate. Creation is done by
        # copying the original pipeline directory so some new location
        # and renaming it to the `run_uuid`.
        run_uuid = uuid()

        # TODO: the pipeline_dir can be gotten from the `run_config`
        # TODO: specify how the pipeline_dir path is given inside the
        #       schema.
        pipeline_uuid = post_data['pipeline_description']['uuid']
        pipeline_dir = os.path.join('/userdir', 'pipelines', pipeline_uuid)
        # pipeline_dir: str = run_config['pipeline_dir']

        # TODO: Now that the copying is done here we need the mount of
        #       the userdir, this can be removed once Celery takes care
        #       of this.
        # Make copy of `pipeline_dir` to `run_dir`.
        # /userdir/pipelines/{pipeline_uuid}/
        # -> /userdir/scheduled_runs/{pipeline_uuid}/{run_uuid}/
        scheduled_runs_dir = os.path.join('/userdir', 'scheduled_runs')
        run_base_dir = os.path.join(scheduled_runs_dir, pipeline_uuid)
        run_dir = os.path.join(run_base_dir, run_uuid)
        os.makedirs(run_base_dir, exist_ok=True)
        copytree(pipeline_dir, run_dir)

        # Update `pipeline_dir` in `run_config`.
        run_config = post_data['run_config']
        scheduled_run_subpath = os.path.join('scheduled_runs', pipeline_uuid, run_uuid)
        run_config['pipeline_dir'] = os.path.join(run_config['host_user_dir'],
                                                  scheduled_run_subpath)

        run_config['run_endpoint'] = 'scheduled_runs'

        pipeline = construct_pipeline(**post_data)

        # Create Celery object with the Flask context and construct the
        # kwargs for the job.
        celery = make_celery(current_app)
        celery_job_kwargs = {
            'pipeline_description': pipeline.to_dict(),
            'run_config': run_config,
        }

        # Start the run as a background task on Celery. Due to circular
        # imports we send the task by name instead of importing the
        # function directly.
        scheduled_date_time = post_data['scheduled_date_time']
        scheduled_date_time = scheduled_date_time.replace('Z', '+00:00')
        scheduled_date_time = datetime.fromisoformat(scheduled_date_time)

        celery.send_task('app.core.runners.run_partial',
                         task_id=run_uuid,
                         eta=scheduled_date_time,
                         kwargs=celery_job_kwargs)

        scheduled_run = {
           'run_uuid': run_uuid,
           'pipeline_uuid': pipeline.properties['uuid'],
           'status': 'PENDING',
           'scheduled_start': scheduled_date_time,
        }
        db.session.add(models.ScheduledRun(**scheduled_run))

        # TODO: this code is also in `namespace_runs`. Maybe move it to
        #       a function so that it can be reused and the code becomes
        #       dry.
        # Set an initial value for the status of the pipline steps that
        # will be run.
        step_uuids = [s.properties['uuid'] for s in pipeline.steps]
        step_statuses = []
        for step_uuid in step_uuids:
            step_statuses.append(models.ScheduledStepStatus(**{
                'run_uuid': run_uuid,
                'step_uuid': step_uuid,
                'status': 'PENDING'
            }))
        db.session.bulk_save_objects(step_statuses)
        db.session.commit()

        scheduled_run['step_statuses'] = step_statuses
        return scheduled_run, 201


@api.route('/<string:run_uuid>')
@api.param('run_uuid', 'UUID for Scheduled Run')
@api.response(404, 'Scheduled Run not found')
class ScheduledRun(Resource):
    @api.doc('get_scheduled_run')
    @api.marshal_with(scheduled_run, code=200)
    def get(self, run_uuid):
        """Fetch a run given its UUID."""
        run = models.ScheduledRun.query.get_or_404(run_uuid,
                                                   description='Run not found')
        return run.__dict__

    @api.doc('set_scheduled_run_status')
    @api.expect(status_update)
    def put(self, run_uuid):
        """Set the status of a run."""
        post_data = request.get_json()

        res = models.ScheduledRun.query.filter_by(run_uuid=run_uuid).update({
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
        # TODO: https://stackoverflow.com/questions/39191238/revoke-a-task-from-celery
        # NOTE: delete new pipeline files that were created for this specific run?

        # Stop the run, whether it is in the queue or whether it is
        # actually running.
        revoke(run_uuid, terminate=True)

        run_res = models.ScheduledRun.query.filter_by(
            run_uuid=run_uuid
        ).update({
            'status': 'REVOKED'
        })

        step_res = models.ScheduledStepStatus.query.filter_by(
            run_uuid=run_uuid
        ).update({
            'status': 'REVOKED'
        })

        if run_res and step_res:
            db.session.commit()

        return {'message': 'Run termination was successful'}, 200


@api.route(
    '/<string:run_uuid>/<string:step_uuid>',
    doc={
        'description': 'Set and get execution status of steps of scheduled runs.'
    }
)
@api.param('run_uuid', 'UUID for Run')
@api.param('step_uuid', 'UUID of Pipeline Step')
@api.response(404, 'Pipeline step not found')
class ScheduledStepStatus(Resource):
    @api.doc('get_step_status')
    @api.marshal_with(step_status, code=200)
    def get(self, run_uuid, step_uuid):
        """Fetch a step of a given scheduled run given their ids."""
        # TODO: Returns the status and logs. Of course logs are empty if
        #       the step is not executed yet.
        step = models.ScheduledStepStatus.query.get_or_404(
            ident=(run_uuid, step_uuid),
            description='Scheduled run and step combination not found'
        )
        return step.__dict__

    @api.doc('set_step_status')
    @api.expect(status_update)
    def put(self, run_uuid, step_uuid):
        """Set the status of a scheduleld run step."""
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

        res = models.ScheduledStepStatus.query.filter_by(
            run_uuid=run_uuid, step_uuid=step_uuid
        ).update(data)

        if res:
            db.session.commit()

        return {'message': 'Status was updated successfully'}, 200
