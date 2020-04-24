from celery import Celery


def make_celery(app):
    # TODO: later the Celery instance has to be initialized with the app
    #       config that states the broker etc.
    celery = Celery(
        app.import_name,
    )
    celery.conf.update(app.config)

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery
