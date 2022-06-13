"""Implements webhooks logic.

A Webhook is an instance of a subscriber, such a module should implement
at least the following:
- a send_ping() function to send out a test delivery of the subscriber.
- a way to create the subscriber, e.g. create_webhook.
- a way to deliver a given delivery using the subscriber, i.e.
    deliver(delivery_uuid).

"""
import datetime
import hashlib
import hmac
import json
import secrets
import uuid
from typing import List, Optional, Set

import requests
import validators
from flask_restx import marshal
from sqlalchemy.orm import exc, noload

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

    marshaled_webhook_spec = marshal(webhook_spec, schema.webhook_spec)

    if not validators.url(marshaled_webhook_spec["url"]):
        raise ValueError(f'Invalid url: {marshaled_webhook_spec["url"]}.')

    secret = marshaled_webhook_spec.get("secret")
    # Replace None and "".
    if secret is None or not secret:
        secret = secrets.token_hex(64)

    webhook = models.Webhook(
        url=marshaled_webhook_spec["url"],
        name=marshaled_webhook_spec["name"],
        verify_ssl=marshaled_webhook_spec["verify_ssl"],
        secret=secret,
        content_type=marshaled_webhook_spec["content_type"],
    )
    db.session.add(webhook)

    db.session.flush()
    subs = notification_utils.subscription_specs_to_subscriptions(
        webhook.uuid, marshaled_webhook_spec["subscriptions"]
    )
    db.session.bulk_save_objects(subs)

    return webhook


def _get_subscription_comparison_key(subscription: models.Subscription) -> str:
    event_type = getattr(subscription, "event_type")
    project_uuid = getattr(subscription, "project_uuid", "")
    job_uuid = getattr(subscription, "job_uuid", "")
    return f"{event_type}|{project_uuid}|{job_uuid}"


def _get_subscription_comparison_key_set(
    subscriptions: List[models.Subscription],
) -> Set[str]:
    sub_keys = set()
    for subscription in subscriptions:
        comparison_key = _get_subscription_comparison_key(subscription)
        sub_keys.add(comparison_key)
    return sub_keys


def update_webhook(uuid: str, mutation: dict) -> None:
    """Update a Webhook, does not commit.

    Args:
        uuid: UUID of a webhook
        mutation: Same as webhook_spec, but all fields are optional.

    """

    try:
        webhook = (
            models.Webhook.query.with_for_update()
            .filter(models.Webhook.uuid == uuid)
            .one()
        )
        if mutation.get("subscriptions") is not None:
            # Query subscriptions separately because with_for_update
            # does not support joinload.
            existing_subs = models.Subscription.query.with_for_update().filter_by(
                subscriber_uuid=uuid
            )

    except exc.MultipleResultsFound:
        raise ValueError(f"Multiple webhooks with UUID {uuid} exist")
    except exc.NoResultFound:
        raise ValueError(f"Webhook with UUID {uuid} not found.")

    marshaled_mutation = marshal(mutation, schema.webhook_mutation)

    valid_mutation = [
        (key, value) for key, value in marshaled_mutation.items() if value is not None
    ]

    if len(valid_mutation) == 0:
        raise ValueError("None of the given attributes in the payload is valid.")

    for key, value in valid_mutation:

        if key == "url" and not validators.url(value):
            raise ValueError(f"Invalid url: {value}.")

        if key == "subscriptions":
            new_subs = notification_utils.subscription_specs_to_subscriptions(
                webhook.uuid, value
            )

            existing_subs_keys = _get_subscription_comparison_key_set(existing_subs)
            new_subs_keys = _get_subscription_comparison_key_set(new_subs)

            sub_keys_to_remove = existing_subs_keys.difference(new_subs_keys)
            sub_keys_to_add = new_subs_keys.difference(existing_subs_keys)

            # Delete subscriptions.
            for existing_sub in existing_subs:
                if _get_subscription_comparison_key(existing_sub) in sub_keys_to_remove:
                    db.session.delete(existing_sub)

            # Add subscriptions.
            subs_to_add = [
                new_sub
                for new_sub in new_subs
                if _get_subscription_comparison_key(new_sub) in sub_keys_to_add
            ]

            db.session.bulk_save_objects(subs_to_add)
            continue

        setattr(webhook, key, value)


def _create_delivery_payload(delivery: models.Delivery) -> dict:

    webhook = (
        models.Webhook.query.options(noload(models.Webhook.subscriptions))
        .filter(models.Webhook.uuid == delivery.deliveree)
        .one()
    )

    payload = {
        "delivered_for": marshal(webhook, schema.webhook),
        "event": delivery.notification_payload,
    }
    _post_process_payload(payload, webhook)

    return payload


def _post_process_payload(payload: dict, webhook: models.Webhook) -> None:
    # For security, might contain secrets etc.
    payload["delivered_for"].pop("url", None)
    # To keep thing brief.
    payload["delivered_for"].pop("subscriptions", None)

    if webhook.is_slack_webhook() or webhook.is_teams_webhook():
        payload["text"] = json.dumps(payload, sort_keys=True, indent=1)
    elif webhook.is_discord_webhook():
        payload["content"] = json.dumps(payload, sort_keys=True, indent=1)
        # 2000 max allowed characters.
        if len(payload["content"]) > 2000:
            payload["delivered_for"] = {
                "uuid": payload["delivered_for"].get("uuid"),
                "name": payload["delivered_for"].get("name"),
            }
            payload["content"] = json.dumps(payload, sort_keys=True, indent=1)

            payload["content"] = f'{payload["content"][:1997]}...'


def _inject_headers(
    headers: dict, event_type: str, delivery_uuid: str, signature: str
) -> None:
    headers["X-Orchest-Event"] = event_type
    headers["X-Orchest-Delivery"] = delivery_uuid
    headers["X-Hub-Signature"] = signature
    headers["User-Agent"] = "Orchest"


def _prepare_request(
    delivery: models.Delivery, deliveree: models.Webhook
) -> requests.PreparedRequest:
    payload = _create_delivery_payload(delivery)

    # Prepare the request, then sign the body.
    if deliveree.content_type == models.Webhook.ContentType.URLENCODED.value:
        # Entries that aren't primitive types are encoded to string.
        urlencoded_payload = {}
        urlencoded_payload["delivered_for"] = json.dumps(payload["delivered_for"])
        urlencoded_payload["event"] = json.dumps(payload["event"])
        request = requests.Request("POST", deliveree.url, data=urlencoded_payload)
    elif deliveree.content_type == models.Webhook.ContentType.JSON.value:
        request = requests.Request("POST", deliveree.url, json=payload)

    request = request.prepare()
    body = request.body
    if not isinstance(body, bytes):
        body = body.encode("utf-8")
    signature = hmac.new(bytes(deliveree.secret, "utf-8"), body, hashlib.sha256)

    _inject_headers(
        request.headers, payload["event"]["type"], delivery.uuid, signature.hexdigest()
    )

    return request


def send_test_ping_delivery(deliveree_uuid: str) -> Optional[requests.Response]:
    webhook = (
        models.Webhook.query.options(noload(models.Subscriber.subscriptions))
        .filter(models.Webhook.uuid == deliveree_uuid)
        .one()
    )

    payload = {
        "delivered_for": marshal(webhook, schema.webhook),
        "event": {
            "type": "ping",
            "uuid": str(uuid.uuid4()),
            "timestamp": str(datetime.datetime.now(datetime.timezone.utc)),
        },
    }
    _post_process_payload(payload, webhook)

    if webhook.content_type == models.Webhook.ContentType.URLENCODED.value:
        urlencoded_payload = {}
        urlencoded_payload["delivered_for"] = json.dumps(payload["delivered_for"])
        urlencoded_payload["event"] = json.dumps(payload["event"])
        request = requests.Request("POST", webhook.url, data=urlencoded_payload)
    elif webhook.content_type == models.Webhook.ContentType.JSON.value:
        request = requests.Request("POST", webhook.url, json=payload)

    request = request.prepare()
    body = request.body
    if not isinstance(body, bytes):
        body = body.encode("utf-8")
    signature = hmac.new(bytes(webhook.secret, "utf-8"), body, hashlib.sha256)

    _inject_headers(
        request.headers,
        payload["event"]["type"],
        str(uuid.uuid4()),
        signature.hexdigest(),
    )

    try:
        with requests.Session() as session:
            return session.send(request, verify=webhook.verify_ssl, timeout=5)
    except Exception as e:
        logger.error(e)
        return None


def deliver(delivery_uuid: str) -> None:
    """Delivers a webhook delivery. Will commit to the database.

    If the delivery fails it's rescheduled in the future with a capped
    exponential backoff. This function will commit to the database to
    ensure that each delivery get its own transaction.

    The delivery is performed by sending a json or form encoded body and
    with the following headers:
        X-Orchest-Event: event type that triggered the delivery
        X-Orchest-Delivery: uuid of the deliery
        X-Hub-Signature: hmac signature computed with the webhook
            secret and sha256. Standardizes name as per:
            https://www.w3.org/TR/websub/#conformance-classes
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
                # Not really useful to set_delivered() atm since it will
                # get deleted, but we might add some collateral effects
                # or other logic to set_delivered in the future.
                db.session.delete(delivery)
            else:
                raise self_errors.DeliveryFailed(
                    f"Failed to deliver {delivery_uuid}: {response.status_code}."
                )
        except Exception as e:
            logger.error(e)
            delivery.reschedule()
            logger.info(f"Rescheduling {delivery_uuid} at {delivery.scheduled_at}.")

    db.session.commit()
