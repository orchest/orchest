"""Use the Flask application factory pattern.

Additinal note:
    `pytest` requires this __init__.py file to be present for version of
    Python below and including version 3.2.

        https://docs.pytest.org/en/latest/goodpractices.html
"""
from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from app.config import CONFIG_CLASS
import os
import logging

db = SQLAlchemy()

from app.views import register_views
from app.proxy import register_proxy

def create_app():

    app = Flask(__name__)
    app.config.from_object(CONFIG_CLASS)

    db.init_app(app)
    # db.create_all()

    # static file serving
    @app.route('/public/<path:path>')
    def send_files(path):
        return send_from_directory("../static", path)

    register_views(app, db)

    proxy = register_proxy(app)

    app.register_blueprint(proxy)

    return app
