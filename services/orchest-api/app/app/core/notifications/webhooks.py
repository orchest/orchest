"""Implements webhooks logic.

A Webhook is an instance of a subscriber, such a module should implement
at least the following:
- a send_ping() function to send out a test delivery of the subscriber.
- a way to create the subscriber, e.g. create_webhook.
- a way to deliver a given delivery using the subscriber, i.e.
    deliver(delivery_uuid).

"""
import secrets

import validators

from app import models
from app.connections import db
from app.core.notifications import utils as notification_utils


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
