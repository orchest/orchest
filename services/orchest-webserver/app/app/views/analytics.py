import os

from flask import request
from app.analytics import send_event


def register_analytics_views(app, db):
    @app.route("/analytics", methods=["POST"])
    def analytics_send_event():
        if send_event(app, request.json["event"], request.json["properties"]):
            return ""
        else:
            return "", 500
