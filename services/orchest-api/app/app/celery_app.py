from celery import Celery

from config import CONFIG_CLASS


def make_celery(app):
    celery = Celery(
        app.import_name,
        config_source=CONFIG_CLASS
    )
    celery.conf.update(app.config)

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery
