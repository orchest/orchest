from celery import Celery
from config import CONFIG_CLASS
from sqlalchemy_utils import create_database, database_exists


def make_celery(app, use_backend_db=False):
    if use_backend_db:
        # create celery database if needed
        if not database_exists(CONFIG_CLASS.result_backend_sqlalchemy_uri):
            create_database(CONFIG_CLASS.result_backend_sqlalchemy_uri)

    celery = Celery(app.import_name, config_source=CONFIG_CLASS)
    celery.conf.update(app.config)

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery
