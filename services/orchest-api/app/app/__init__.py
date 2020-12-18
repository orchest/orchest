"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
import os

from flask import Flask
from flask_cors import CORS
from sqlalchemy_utils import create_database, database_exists

from app.apis import blueprint as api
from app.connections import db
from app.models import InteractiveSession, InteractivePipelineRun
from config import CONFIG_CLASS


def create_app(config_class=None, use_db=True):
    """Create the Flask app and return it.

    Args:
        config_class: Configuration class. See orchest-api/app/config.
        use_db: If true, associate a database to the Flask app instance,
            which implies connecting to a given database and possibly
            creating such database and/or tables if they do not exist
            already. The reason to differentiate instancing the app
            through this argument is that the celery worker does not
            need to connect to the db that "belongs" to the orchest-api.

    Returns:
        Flask.app
    """
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Cross-origin resource sharing. Allow API to be requested from the
    # different microservices such as the webserver.
    CORS(app, resources={r"/*": {"origins": "*"}})

    if use_db:
        # Create the database if it does not exist yet. Roughly equal to
        # a "CREATE DATABASE IF NOT EXISTS <db_name>" call.
        if not database_exists(app.config["SQLALCHEMY_DATABASE_URI"]):
            create_database(app.config["SQLALCHEMY_DATABASE_URI"])

        db.init_app(app)
        with app.app_context():
            # This call will create tables if needed (the ones which do
            # not exist in the database yet).
            db.create_all()

            # In case of an ungraceful shutdown, these entities could be
            # in an invalid state, so they are deleted, since for sure
            # they are not running anymore.
            # To avoid the issue of entities being deleted because of a
            # flask app reload triggered by a dev mode code change, we
            # attempt to create a directory first. Since this is an
            # atomic operation that will result in an error if the
            # directory is already there, this cleanup operation will
            # run only once per container.
            try:
                os.mkdir("/tmp/interactive_cleanup_done")
                InteractiveSession.query.delete()
                InteractivePipelineRun.query.filter(
                    InteractivePipelineRun.status.in_(["PENDING", "STARTED"])
                ).delete(synchronize_session="fetch")
                db.session.commit()
            except FileExistsError:
                pass

    # Register blueprints.
    app.register_blueprint(api, url_prefix="/api")

    return app
