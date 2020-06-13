from datetime import datetime
import os
from shutil import copytree

from celery import uuid
from celery.task.control import revoke
from flask import current_app, request
from flask_restplus import Namespace, Resource, fields

from app.connections import db
import app.models as models
from app.celery_app import make_celery
from app.utils import construct_pipeline
from app.schema import step_status, status_update, scheduled_run_configuration, scheduled_run, scheduled_runs



api = Namespace('scheduled_runs', description='Managing (partial) scheduled runs')

api.models[step_status.name] = step_status
api.models[status_update.name] = status_update
api.models[scheduled_run_configuration.name] = scheduled_run_configuration
api.models[scheduled_run.name] = scheduled_run
api.models[scheduled_runs.name] = scheduled_runs


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

        # run_uuid is the same as celery task_id in this context.
        # the celery uuid is usually created by celery itself with send_task and returned to us
        # but it needs to be created ahead of time because it is used to copy the pipeline
        # directory to its new location. This new pipeline directory is then passed to the
        # send_task call as a keyword arguments.
        run_uuid = uuid()
        pipeline_uuid = post_data['pipeline_description']['uuid']

        # TODO: abstract to a general function once namespace_experiments is
        # started so it can be reused.
        old_pipeline_dir = os.path.join('/userdir', 'pipelines', pipeline_uuid)

        # setup new directory hierarchy
        scheduled_runs_dir = os.path.join('/userdir', 'scheduled_runs')
        pipeline_dir = os.path.join(scheduled_runs_dir, pipeline_uuid)
        run_dir = os.path.join(pipeline_dir, run_uuid)

        # pipeline_dir may already exist
        if not os.path.exists(pipeline_dir):
            os.makedirs(pipeline_dir)
        # /userdir/pipelines/{pipeline_uuid}/ -> /userdir/scheduled_runs/{pipeline_uuid}/{run_uuid}/
        copytree(old_pipeline_dir, run_dir)

        # need to update the host pipeline_dir to reflect the new directory
        scheduled_run_subpath = os.path.join('scheduled_runs', pipeline_uuid, run_uuid)
        post_data['run_config']['pipeline_dir'] = os.path.join(post_data['run_config']['host_user_dir'], scheduled_run_subpath)


        post_data['run_config']['run_endpoint'] = 'scheduled_runs'

        scheduled_date_time_string = post_data['scheduled_date_time']
        scheduled_date_time = datetime.fromisoformat(scheduled_date_time_string.replace('Z', '+00:00'))
            
        # Construct pipeline.
        pipeline = construct_pipeline(**post_data)

        print(current_app.name)

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
                                task_id = run_uuid,
                                eta=scheduled_date_time,
                               kwargs=celery_job_kwargs)

        scheduled_run = {
           'run_uuid': run_uuid,
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
        # TODO: https://stackoverflow.com/questions/39191238/revoke-a-task-from-celery
        # NOTE: delete new pipeline files that were created for this specific run?

        # Stop the run, whether it is in the queue or whether it is
        # actually running.
        revoke(run_uuid, terminate=True)

        run = models.ScheduledRun.query.filter_by(run_uuid=run_uuid).first()
        run.status = 'REVOKED'

        for status in run.step_statuses:
            status.status = 'REVOKED'
            
        db.session.commit()

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
