"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
from celery import Celery
from flask import Flask
from flask_cors import CORS

from app.apis import blueprint as api
from app.connections import db
from config import CONFIG_CLASS


celery = Celery(__name__, config_source=CONFIG_CLASS)


def create_app(config_class=None):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Something
    CORS(app, resources={r'/*': {'origins': '*'}})

    # Initialize the database and create the database file.
    db.init_app(app)
    with app.app_context():
        db.create_all()

    # Register blueprints.
    app.register_blueprint(api, url_prefix='/api')

    return app
