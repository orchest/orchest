import random
from flask import request

def register_views(app):

    @app.route("/auth", methods=["GET"])
    def index():

        # TODO: implement authentication mechanism. Currently, all requests
        # return 200
        return '', 200