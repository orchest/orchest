"""Implements webhooks logic.

A Webhook is an instance of a subscriber, such a module should implement
at least the following:
- a send_ping() function to send out a test delivery of the subscriber.
- a way to create the subscriber, e.g. create_webhook.
- a way to deliver a given delivery using the subscriber, i.e.
    deliver(delivery_uuid).

"""
import hashlib
import hmac
import json
import secrets

import requests
import validators
from flask_restx import marshal
from sqlalchemy.orm import joinedload

from app import errors as self_errors
from app import models, schema
from app import utils as app_utils
from app.connections import db
from app.core.notifications import utils as notification_utils

logger = app_utils.get_logger()


def create_webhook(webhook_spec: dict) -> models.Webhook:
    """Adds a Webhook model to the db, does not commit.

    Args:
        webhook_spec: Spec of the webhook to create. See weebhook_spec
            in services/orchest-api/app/app/schema.py.

    """

    if not validators.url(webhook_spec["url"]):
        raise ValueError(f'Invalid url: {webhook_spec["url"]}.')

    webhook = models.Webhook(
        url=webhook_spec["url"],
        name=webhook_spec["name"],
        verify_ssl=webhook_spec["verify_ssl"],
        secret=webhook_spec.get("secret", secrets.token_hex(64)),
        content_type=webhook_spec["content_type"],
    )
    db.session.add(webhook)

    db.session.flush()
    subs = notification_utils.subscription_specs_to_subscriptions(
        webhook.uuid, webhook_spec["subscriptions"]
    )
    db.session.bulk_save_objects(subs)

    return webhook


def _create_delivery_payload(delivery: models.Delivery) -> dict:
    webhook = (
        models.Webhook.query.options(joinedload(models.Webhook.subscriptions))
        .filter(models.Webhook.uuid == delivery.deliveree)
        .one()
    )
    webhook = marshal(webhook, schema.webhook)

    event = models.Event.query.filter(models.Event.uuid == delivery.event).one()
    event = event.to_notification_payload()

    payload = {"delivered_for": webhook, "event": event}
    return payload


def _prepare_request(
    delivery: models.Delivery, deliveree: models.Webhook
) -> requests.PreparedRequest:
    payload = _create_delivery_payload(delivery)

    # Prepare the request, then sign the body.
    if deliveree.content_type == models.Webhook.ContentType.URLENCODED.value:
        # Entries that aren't primitive types are encoded to string.
        payload["delivered_for"] = json.dumps(payload["delivered_for"])
        payload["event"] = json.dumps(payload["event"])
        request = requests.Request("POST", deliveree.url, data=payload)
    elif deliveree.content_type == models.Webhook.ContentType.JSON.value:
        request = requests.Request("POST", deliveree.url, json=payload)

    request = request.prepare()
    body = request.body
    if not isinstance(body, bytes):
        body = body.encode("utf-8")
    signature = hmac.new(bytes(deliveree.secret, "utf-8"), body, hashlib.sha256)

    request.headers["X-Orchest-Event"] = payload["event"]["type"]
    request.headers["X-Orchest-Delivery"] = delivery.uuid
    request.headers["X-Orchest-Signature"] = signature.hexdigest()
    request.headers["User-Agent"] = "Orchest"

    return request


def deliver(delivery_uuid: str) -> None:
    """Delivers a webhook delivery. Will commit to the database.

    If the delivery fails it's rescheduled in the future with a capped
    exponential backoff. This function will commit to the database to
    ensure that each delivery get its own transaction.

    The delivery is performed by sending a json or form encoded body and
    with the following headers:
        X-Orchest-Event: event type that triggered the delivery
        X-Orchest-Delivery: uuid of the deliery
        X-Orchest-Signature: hmac signature computed with the webhook
            secret and sha256.
        User-Agent: Orchest

    Args:
        delivery_uuid: Delivery to be delivered, the associated
            deliveree must be a Webhook.

    Raises:
        ValueError: If the associated deliveree isn't a Webhook.

    """
    logger.info(f"Delivering {delivery_uuid}.")

    delivery = (
        models.Delivery.query.with_for_update(skip_locked=True)
        .filter(
            models.Delivery.uuid == delivery_uuid,
            models.Delivery.status.in_(["SCHEDULED", "RESCHEDULED"]),
        )
        .first()
    )
    if delivery is None:
        logger.info(f"No need to deliver {delivery_uuid}.")
        return

    deliveree = models.Webhook.query.filter(
        models.Webhook.uuid == delivery.deliveree
    ).first()
    if deliveree is None:
        raise ValueError("Deliveree of delivery isn't of type webhook.")

    request = _prepare_request(delivery, deliveree)

    with requests.Session() as session:
        try:
            response = session.send(request, verify=deliveree.verify_ssl, timeout=5)
            if response.status_code >= 200 and response.status_code <= 299:
                logger.info(f"Delivered {delivery_uuid}.")
                delivery.set_delivered()
            else:
                raise self_errors.DeliveryFailed(
                    f"Failed to deliver {delivery_uuid}: {response.status_code}."
                )
        except Exception as e:
            logger.error(e)
            delivery.reschedule()
            logger.info(f"Rescheduling {delivery_uuid} at {delivery.scheduled_at}.")

    db.session.commit()
