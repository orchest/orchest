"""API endpoints related to notifications."""

import sqlalchemy
from flask import request
from flask_restx import Namespace, Resource, marshal
from sqlalchemy.orm import joinedload, noload

from app import models, schema, utils
from app.connections import db
from app.core import notifications
from app.core.notifications import webhooks

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
    @api.response(200, "Success", schema.subscribers)
    def get(self):
        """Gets all subscribers, doesn't include their subscriptions."""
        subscribers = models.Subscriber.query.options(
            noload(models.Subscriber.subscriptions)
        ).all()
        marshalled = []
        for subscriber in subscribers:
            if isinstance(subscriber, models.Webhook):
                marshalled.append(marshal(subscriber, schema.webhook))
            else:
                marshalled.append(marshal(subscriber, schema.subscriber))
        return {"subscribers": marshalled}, 200


@api.route("/subscribers/webhooks")
class WebhookList(Resource):
    @api.doc("create_webhook")
    @api.expect(schema.webhook_spec, validate=True)
    @api.response(201, "Success", schema.webhook_with_secret)
    def post(self):
        """Creates a webhook with the given subscriptions.

        Repeated subscription entries are ignored. If no secret is
        passed a secret will be generated through the BE. This endpoint
        returns a model with said secret, all other endpoints do not,
        meaning that it's not possible to get back a secret from the BE
        once the webhook has been created, for security reasons.
        """
        try:
            webhook = webhooks.create_webhook(request.get_json())
        except (ValueError, sqlalchemy.exc.IntegrityError) as e:
            return {"message": str(e)}, 400

        db.session.commit()
        return marshal(webhook, schema.webhook_with_secret), 201


@api.route("/subscribers/<string:uuid>")
class Subscriber(Resource):
    @api.doc("subscriber")
    @api.response(200, "Success", schema.subscriber)
    @api.response(200, "Success", schema.webhook)
    def get(self, uuid: str):
        """Gets a subscriber, including its subscriptions."""
        subscriber = (
            models.Subscriber.query.options(joinedload(models.Subscriber.subscriptions))
            .filter(models.Subscriber.uuid == uuid)
            .first()
        )
        if subscriber is None:
            return {"message": f"Subscriber {uuid} does not exist."}, 404

        if isinstance(subscriber, models.Webhook):
            subscriber = marshal(subscriber, schema.webhook)
        else:
            subscriber = marshal(subscriber, schema.subscriber)

        return subscriber, 200

    @api.doc("delete_subscriber")
    def delete(self, uuid: str):
        models.Subscriber.query.filter(models.Subscriber.uuid == uuid).delete()
        db.session.commit()
        return {"message": ""}, 201


@api.route("/subscribers/test-ping-delivery/<string:uuid>")
class SendSubscriberTestPingDelivery(Resource):
    @api.doc("subscribers/test-ping-delivery")
    @api.response(200, "Success")
    @api.response(500, "Failure")
    def get(self, uuid: str):
        """Send a test ping delivery to the subscriber.

        This endpoint allows to send a ping event notifications to the
        subscriber, so that it's possible to test if a given webhook
        is working end to end, i.e. the deliveree is reachable.

        The endpoint will return a 200 if the response obtained from the
        deliveree is to be considered successfull, 500 otherwise.

        """
        response = webhooks.send_test_ping_delivery(uuid)
        if (
            response is not None
            and response.status_code >= 200
            and response.status_code <= 299
        ):
            return {"message": "success"}, 200
        else:
            if response is not None:
                logger.info(response.status_code)
                logger.info(response.text)
            return {"message": "failure"}, 500


@api.route("/subscribers/subscribed-to/<string:event_type>")
class SubscribersSubscribedToEvent(Resource):
    @api.doc("get_subscribers_subscribed_to_event")
    @api.response(200, "Success", schema.subscribers)
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

        marshalled = []
        for subscriber in alerted_subscribers:
            if isinstance(subscriber, models.Webhook):
                marshalled.append(marshal(subscriber, schema.webhook))
            else:
                marshalled.append(marshal(subscriber, schema.subscriber))

        return {"subscribers": marshalled}, 200
