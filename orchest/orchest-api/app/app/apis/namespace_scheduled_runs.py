from datetime import datetime

from celery.task.control import revoke
from flask import current_app, request
from flask_restplus import Namespace, Resource, fields

from app.connections import db
import app.models as models
from app.celery_app import make_celery
from app.utils import construct_pipeline

from shutil import copytree, ignore_patterns
import os

from celery import uuid

from app.schema import step_status, status_update, run_configuration, run




RUN_ENDPOINT = 'scheduled_runs'

api = Namespace(RUN_ENDPOINT, description='Managing (partial) scheduled runs')


api.models[step_status.name] = step_status
api.models[status_update.name] = status_update


scheduled_run_configuration = api.inherit('Scheduled Run Configuration', run_configuration, {
    "scheduled_start": fields.String(
        required=True,
        description='Time at which the run is scheduled to start'),
})


scheduled_run = api.inherit('Scheduled Run', run, {
    "scheduled_start": fields.String(
        required=True,
        description='Time at which the run is scheduled to start'),
})


scheduled_runs = api.model('Scheduled Runs', {
    'scheduled_runs': fields.List(
        fields.Nested(scheduled_run),
        description='past, present and running scheduled_runs')
})



@api.route('/')
class ScheduledRunList(Resource):
    @api.doc('get_scheduled_runs')
    @api.marshal_with(scheduled_runs)
    def get(self):
        """Fetch all scheduled runs.

        Either in the queue, running or already completed.
        """
        scheduled_runs = models.ScheduledRun.query.all()
        return {'scheduled_runs': [scheduled_run.as_dict() for scheduled_run in scheduled_runs]}, 200


    @api.doc('start_scheduled_run')
    @api.expect(scheduled_run_configuration)
    @api.marshal_with(scheduled_run, code=201, description='Scheduled Run Scheduled')
    def post(self):
        """Schedule a new run"""
        post_data = request.get_json()

        # https://github.com/celery/celery/issues/1813
        # could use https://docs.celeryproject.org/en/latest/userguide/signals.html#before-task-publish



        # TODO: make DB persistent (on file, not state)

        task_id = uuid()

        # post_data['run_config']['pipeline_dir'] = 
        #   /host_mnt/c/Users/ASUS/Documents/Orchest.io/orchest/orchest/userdir/pipelines/9ac1246c-b607-4ee3-b0af-bfa92f9299e6

        # first, copy original pipeline into new directory under .scheduled_runs/run_uuid
        pipeline_dir = f"/userdir/pipelines/{post_data['pipeline_description']['uuid']}"

        scheduled_runs_dir = '.scheduled_runs'
        scheduled_runs_path = os.path.join(pipeline_dir, scheduled_runs_dir)

        if not os.path.exists(scheduled_runs_path):
            os.mkdir(scheduled_runs_path)

        scheduled_run_pipeline_dir = os.path.join(scheduled_runs_path, task_id)
        copytree(pipeline_dir, scheduled_run_pipeline_dir, ignore=ignore_patterns(scheduled_runs_dir))


        # second, prepare new mount directory for runnable-images to run
        scheduled_run_dir = os.path.join(scheduled_runs_dir, task_id)
        pipeline_dir_mount = os.path.join(post_data['run_config']['pipeline_dir'], scheduled_run_dir)
        
        post_data['run_config']['pipeline_dir'] = pipeline_dir_mount
        post_data['run_config']['run_endpoint'] = RUN_ENDPOINT

        
        scheduled_date_time_string = post_data['scheduled_date_time']
        scheduled_date_time = datetime.fromisoformat(scheduled_date_time_string.replace('Z', '+00:00'))
            
        # Construct pipeline.
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
        celery.send_task('app.core.runners.run_partial',
                                task_id = task_id,
                                eta=scheduled_date_time,
                               kwargs=celery_job_kwargs)

        # TODO: if celery, rabbitmq or this api fail, then upon system
        # reboot, we must go through scheduled_runs.db and check for runs with the status PENDING.
        # if one is PENDING, then we must call this API endpoint again, so that it can
        # either continue to be PENDING, or if the datetime has passed, it can run immedately.
        scheduled_run = {
           'run_uuid': task_id,
           'pipeline_uuid': pipeline.properties['uuid'],
           'status': 'PENDING',
           'scheduled_start': scheduled_date_time,
        }
        db.session.add(models.ScheduledRun(**scheduled_run))

        # Set an initial value for the status of the pipline steps that
        # will be run.
        step_uuids = [s.properties['uuid'] for s in pipeline.steps]
        
        # TODO: create function(s) to increase DRY in regards to runespace_runs and namespace_scheduled_runs
        step_statuses = []
        for step_uuid in step_uuids:
            step_statuses.append(models.ScheduledStepStatus(**{
                'run_uuid': task_id,
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
        run = models.ScheduledRun.query.get_or_404(run_uuid, description='Run not found')
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

        # Stop the run, whether it is in the queue or whether it is
        # actually running.

        # TODO: https://stackoverflow.com/questions/39191238/revoke-a-task-from-celery
        # TODO: delete new pipeline files that were created for this specific run?
        revoke(run_uuid, terminate=True)

        return {'message': 'Run termination was successful'}, 200


@api.route('/<string:run_uuid>/<string:step_uuid>',
           doc={'description': 'Set and get execution status of steps of scheduled runs.'})
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
