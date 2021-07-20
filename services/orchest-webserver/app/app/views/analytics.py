from flask import request

from app import analytics


def register_analytics_views(app, db):
    @app.route("/analytics", methods=["POST"])
    def analytics_send_event():
        event_name = request.json["event"]
        try:
            analytics_event = analytics.Event(event_name)
        except ValueError:
            app.logger.error(
                f"No analytics event is defined for the given name: '{event_name}'."
            )
            return "Invalid analytics event name.", 500

        success = analytics.send_event(app, analytics_event, request.json["properties"])

        if success:
            return ""
        else:
            return "", 500
