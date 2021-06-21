class Config:
    # TODO: Should we read these from ENV variables instead?
    DEBUG = False
    TESTING = False

    # must be uppercase
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres@orchest-database/orchest_api"

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # TODO: for now this is put here.
    ORCHEST_API_ADDRESS = "http://orchest-api:80/api"

    # How often to run the scheduling logic when the process is running
    # as scheduler, in seconds.
    SCHEDULER_INTERVAL = 10

    # ---- Celery configurations ----
    # NOTE: the configurations have to be lowercase.
    # NOTE: Flask will not configure lowercase variables. Therefore the
    # config class will be loaded directly by the Celery instance.
    broker_url = "amqp://guest:guest@rabbitmq-server:5672//"

    # NOTE: the database might require trimming from time to time, to
    # enable having the db trimmed automatically use:
    # https://docs.celeryproject.org/en/master/userguide/configuration.html#std:setting-result_expires
    # note that "When using the database backend, celery beat must be
    # running for the results to be expired." The db reaching a large
    # size is probably an unreasonable edge case, given that currently
    # our celery tasks do not produce output.  For this reason no
    # solution is provided for this, taking into account that we will
    # eventually implement cronjobs and such trimming might be an
    # internal cronjob, or automatically managed by celery if we end
    # using "celery beat".
    _result_backend_server = "postgres@orchest-database/celery_result_backend"

    # used to create the db if it does not exist, the function needs
    # this exact url format
    result_backend_sqlalchemy_uri = f"postgresql://{_result_backend_server}"
    # this format is used by celery
    result_backend = f"db+postgresql+psycopg2://{_result_backend_server}"

    imports = ("app.core.tasks",)
    task_create_missing_queues = True
    task_default_queue = "celery"
    task_routes = {
        "app.core.tasks.start_non_interactive_pipeline_run": {"queue": "jobs"},
        "app.core.tasks.run_pipeline": {"queue": "celery"},
        "app.core.tasks.build_environment": {"queue": "builds"},
        "app.core.tasks.build_jupyter": {"queue": "builds"},
    }


# ---- CONFIGURATIONS ----
# Production
CONFIG_CLASS = Config
