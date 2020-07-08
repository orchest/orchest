from flask_restplus import Model, fields


# TODO: make logic ordering and rename models to be in line with our new
#       namings, e.g. pipeline runs instead of runs, session instead of
#       launch.
step_status = Model('Pipeline Step', {
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
        description='New status of the step',
        enum=['PENDING', 'STARTED', 'SUCCESS', 'FAILURE', 'ABORTED', 'REVOKED']),
})

# TODO: The fields.Raw have to be replaced later. But since we are still
#       actively chaning this. It is a waste of time to do it now.
# namespace_runs
run_configuration = Model('Run Configuration', {
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
        description='Pipeline description in JSON'),
    'run_config': fields.Raw(  # TODO: must be pipeline_dir and mapping
        required=True,
        description='Configuration for compute backend')
})

run = Model('Run', {
    'run_uuid': fields.String(
        required=True,
        description='UUID for run'),
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

runs = Model('Runs', {
    'runs': fields.List(
        fields.Nested(run),
        description='Ran and running tasks')
})

# namespace_scheduled_runs
experiment_configuration = Model('Experiment Configuration', {
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
    'run_config': fields.Raw(  # TODO: must be pipeline_dir and mapping
        required=True,
        description='Configuration for compute backend'),
    'scheduled_start': fields.String(
        required=True,
        description='Time at which the experiment is scheduled to start'),
    'run_type': fields.String(  # TODO: for now only "full"
        required=False,
        default='full',
        description='Type of run',
        enum=['full', 'selection', 'incoming']),
})

scheduled_run = run.inherit('Scheduled Run', {
    'scheduled_start': fields.String(
        required=True,
        description='Time at which the run is scheduled to start'),
})

scheduled_runs = Model('Scheduled Runs', {
    'scheduled_runs': fields.List(
        fields.Nested(scheduled_run),
        description='past, present and running scheduled_runs')
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
        default='/notebooks',
        description='Working directory'),
    'password': fields.Boolean(
        required=True,
        description='Password if one is set'),
    'pid': fields.Integer(
        required=True,
        description='PID'),
})

launch = Model('Launch', {
    'pipeline_uuid': fields.String(
        required=True,
        description='UUID of pipeline'),
    'server_ip': fields.String(
        required=True,
        description='IP of the Jupyter server'),
    'server_info': fields.Nested(
        server,
        required=True,
        description='Jupyter connection info')
})

launches = Model('Launches', {
    'launches': fields.List(
        fields.Nested(launch),
        description='Currently running launches')
})

pipeline = Model('Pipeline', {
    'pipeline_uuid': fields.String(
        required=True,
        description='UUID of pipeline'),
    'pipeline_dir': fields.String(
        required=True,
        description='Path to pipeline files')
})
