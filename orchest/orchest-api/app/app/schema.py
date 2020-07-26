from flask_restplus import Model, fields


# TODO: make logic ordering and rename models to be in line with our new
#       namings, e.g. pipeline runs instead of runs.
pipeline_step = Model('Pipeline Step', {
    'run_uuid': fields.String(
        required=True,
        description='UUID for run'),
    'step_uuid': fields.String(
        required=True,
        description='UUID of a pipeline step'),
    'status': fields.String(
        required=True,
        description='Status of the step',
        enum=['PENDING', 'STARTED', 'SUCCESS', 'FAILURE', 'ABORTED', 'REVOKED']),
    'started_time': fields.String(
        required=True,
        description='Time at which the step was started'),
    'ended_time': fields.String(
        required=True,
        description='Time at which the step ended execution'),
})

status_update = Model('Status Update', {
    'status': fields.String(
        required=True,
        description='New status of executable, e.g. pipeline',
        enum=['PENDING', 'STARTED', 'SUCCESS', 'FAILURE', 'ABORTED', 'REVOKED']),
})

# namespace_runs
pipeline_run_config = Model('Pipeline Run Configuration', {
    'pipeline_dir': fields.String(
        required=True,
        description='Path to pipeline files'),
    'runnable_image_mapping': fields.Raw(
        required=True,
        description='Mapping from used image to runnable image'),
    # Needed for the celery-worker to set the new pipeline-dir for
    # experiments. Note that the `orchest-webserver` has this value
    # stored in the ENV variable `HOST_USER_DIR`.
    'host_user_dir': fields.String(
        required=False,
        description='Path to the /userdir on the host'),
})

pipeline_run_spec = Model('Pipeline Run Specification', {
    'uuids': fields.List(
        fields.String(),
        required=False,
        description='UUIDs of pipeline steps'),
    'run_type': fields.String(
        required=False,
        default='full',  # TODO: check whether default is used if required=False
        description='Type of run',
        enum=['full', 'selection', 'incoming']),
    'pipeline_description': fields.Raw(
        required=False,  # TODO: it is actually required here but not in the nested experiment_config
        description='Pipeline description in JSON'),
    'run_config': fields.Nested(
        model=pipeline_run_config,
        required=True,
        description='Configuration for compute backend'),
    'scheduled_start': fields.String(  # TODO: make DateTime
        required=False,
        # default=datetime.utcnow().isoformat(),
        description='Time at which the run is scheduled to start'),
})

pipeline_run = Model('Run', {
    # A pipeline run does not have to be part of an experiment, although
    # it can be.
    'experiment_uuid': fields.String(
        required=False,
        description='UUID for experiment'),
    'run_uuid': fields.String(
        required=True,
        description='UUID of run'),
    'pipeline_run_id': fields.Integer(
        required=False,
        description='Respective run ID in experiment'),
    'pipeline_uuid': fields.String(
        required=True,
        description='UUID of pipeline'),
    'status': fields.String(
        required=True,
        description='Status of the run'),
    'step_statuses': fields.List(  # TODO: rename
        fields.Nested(pipeline_step),
        description='Status of each pipeline step'),
    'scheduled_start': fields.String(  # TODO: make DateTime
        required=True,
        description='Time at which the run is scheduled to start'),
})

pipeline_runs = Model('Runs', {
    'runs': fields.List(
        fields.Nested(pipeline_run),
        description='Ran and running tasks')
})

# namespace_scheduled_runs
experiment_spec = Model('Experiment Configuration', {
    'experiment_uuid': fields.String(
        required=True,
        description='UUID for experiment'),
    'pipeline_uuid': fields.String(
        required=True,
        description='UUID of pipeline'),
    'pipeline_descriptions': fields.List(
        fields.Raw(
            description='Pipeline description in JSON'
        ),
        required=True,
        description='Collection of pipeline descriptions',
    ),
    'pipeline_run_ids': fields.List(
        fields.Integer(
            description='Pipeline index corresponding to respective list entries in pipeline_descriptions.'
        ),
        required=True,
        description='Collection of pipeline description indices.',
    ),
    'pipeline_run_spec': fields.Nested(
        model=pipeline_run_spec,
        required=True,
        description='Specification of the pipeline runs, e.g. "full", "incoming" etc'),
    'scheduled_start': fields.String(
        required=True,
        description='Time at which the experiment is scheduled to start'),
})

experiment = Model('Experiment', {
    'experiment_uuid': fields.String(
        required=True,
        description='UUID for experiment'),
    'pipeline_uuid': fields.String(
        required=True,
        description='UUID of pipeline'),
    'pipeline_runs': fields.List(
        fields.Nested(pipeline_run),
        description='Collection of pipeline runs part of the experiment'),
    'scheduled_start': fields.String(
        required=True,
        description='Time at which the experiment is scheduled to start'),
})

experiments = Model('Experiments', {
    'experiments': fields.List(
        fields.Nested(experiment),
        description='Collection of all experiments'),
})

# Models for RESTful API.
server = Model('Server', {
    'url': fields.String(
        required=True,
        description='URL of the server'),
    'hostname': fields.String(
        required=True,
        default='localhost',
        description='Hostname'),
    'port': fields.Integer(
        required=True,
        default=8888,
        description='Port to access the server'),
    'secure': fields.Boolean(
        required=True,
        description='Any extra security measures'),
    'base_url': fields.String(
        required=True,
        default='/',
        description='Base URL'),
    'token': fields.String(
        required=True,
        description='Token for authentication'),
    'notebook_dir': fields.String(
        required=True,
        default='/pipeline-dir',
        description='Working directory'),
    'password': fields.Boolean(
        required=True,
        description='Password if one is set'),
    'pid': fields.Integer(
        required=True,
        description='PID'),
})

session = Model('Session', {
    'pipeline_uuid': fields.String(
        required=True,
        description='UUID of pipeline'),
    'jupyter_server_ip': fields.String(
        required=True,
        description='IP of the jupyter-server'),
    'notebook_server_info': fields.Nested(
        server,
        required=True,
        description='Jupyter notebook server connection info')
})

sessions = Model('Sessions', {
    'sessions': fields.List(
        fields.Nested(session),
        description='Currently running sessions')
})

pipeline = Model('Pipeline', {
    'pipeline_uuid': fields.String(
        required=True,
        description='UUID of pipeline'),
    'pipeline_dir': fields.String(
        required=True,
        description='Path to pipeline files')
})
