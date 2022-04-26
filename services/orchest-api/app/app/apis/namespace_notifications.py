"""API endpoints related to notifications."""

import sqlalchemy
from flask import request
from flask_restx import Namespace, Resource, marshal
from sqlalchemy.orm import joinedload, noload

from app import models, schema, utils
from app.connections import db
from app.core import notifications

api = Namespace("notifications", description="Orchest-api notifications API.")
api = utils.register_schema(api)

logger = utils.get_logger()


@api.route("/subscribable-events")
class SubscribableEventList(Resource):
    @api.doc("subscribable-events")
    def get(self):
        """Gets all subscribable events."""
        return {"events": notifications.get_subscribable_events()}, 200


@api.route("/subscribers")
class SubscriberList(Resource):
    @api.doc("get_subscribers")
    @api.marshal_with(schema.subscribers)
    def get(self):
        """Gets all subscribers, without subscriptions."""
        subscribers = models.Subscriber.query.options(
            noload(models.Subscriber.subscriptions)
        ).all()
        return {"subscribers": subscribers}, 200

    @api.doc("create_subscriber")
    @api.expect(schema.subscriber_spec)
    @api.response(200, "Success", schema.subscriber)
    def post(self):
        """Creates a subscriber with the given subscriptions.

        Repeated subscription entries are ignored.
        """
        subscriber_spec = request.get_json()
        subscriptions = subscriber_spec.get("subscriptions", [])

        try:
            subscriber = notifications.create_subscriber(subscriptions)
        except (ValueError, sqlalchemy.exc.IntegrityError) as e:
            return {"message": str(e)}, 400

        db.session.commit()
        return marshal(subscriber, schema.subscriber), 201


@api.route("/subscribers/<string:uuid>")
class Subscriber(Resource):
    @api.doc("subscriber")
    @api.marshal_with(schema.subscriber)
    def get(self, uuid: str):
        """Gets a subscriber, including its subscriptions."""
        subscriber = (
            models.Subscriber.query.options(joinedload(models.Subscriber.subscriptions))
            .filter(models.Subscriber.uuid == uuid)
            .one()
        )

        return subscriber, 200

    @api.doc("delete_subscriber")
    def delete(self, uuid: str):
        models.Subscriber.query.filter(models.Subscriber.uuid == uuid).delete()
        db.session.commit()
        return {"message": ""}, 201


@api.route("/subscribers/subscribed-to/<string:event_type>")
class SubscribersSubscribedToEvent(Resource):
    @api.doc("get_subscribers_subscribed_to_event")
    @api.marshal_with(schema.subscribers)
    @api.doc(
        "get_subscribers_subscribed_to_event",
        params={
            "project_uuid": {
                "description": (
                    "Optional, uuid of the project to which the event is related."
                ),
                "type": str,
            },
            "job_uuid": {
                "description": (
                    "Optional, uuid of the job to which the event is related, if "
                    "provided, 'project_uuid' must be provided as well."
                ),
                "type": str,
            },
        },
    )
    def get(self, event_type: str):
        """Gets all subscribers subscribed to a given event_type.

        Not passing anything (i.e. just specifying a `event_type`
        through the path, no project/job uuid) means that you will be
        querying for subscribers that are subscribed to the event
        "globally", i.e. not specific to a project or a job, which
        means that subscribers subscribed to a given event for a
        specific project or job would not come up in the result. If you
        know which project or job you are querying for you should
        specify it.

        This can be useful to know if, for example, a given job failure
        would lead to any notification whatsoever.

        Args:
            event_type: An event_type from the list at
                `/subscribable-events`, note that it must be
                percent-encoded, see
                https://developer.mozilla.org/en-US/docs/Glossary/percent-encoding.
        """

        try:
            alerted_subscribers = notifications.get_subscribers_subscribed_to_event(
                event_type,
                request.args.get("project_uuid"),
                request.args.get("job_uuid"),
            )
        except ValueError as e:
            return {"message": str(e)}, 400

        return {"subscribers": alerted_subscribers}, 200
