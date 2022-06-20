from flask import request

from _orchest.internals import analytics


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

        data = analytics.TelemetryData(
            event_properties=request.json["properties"],
            # TODO: will the FE ever have derived properties?
            derived_properties={},
        )
        success = analytics.send_event(app, analytics_event, data)

        if success:
            return ""
        else:
            return "", 500
