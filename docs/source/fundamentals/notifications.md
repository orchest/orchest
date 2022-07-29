(notifications)=

# Notifications

```{eval-rst}
.. meta::
   :description: This page contains information about how to receive notifications for job runs and other events in Orchest.
```

You can receive webhook notifications when specific events happen in Orchest. For example, when a job fails. Whenever an events triggers, Orchest will send an HTTP request to your desired endpoint with a payload of information. For example:

```json
{
  "delivered_for": {
    "name": "Test webhook",
    "verify_ssl": false,
    "content_type": "application/json",
    "uuid": "a1edb89c-1cfb-4086-8f75-ab073612c5bf",
    "type": "webhook"
  },
  "event": {
    "type": "ping",
    "uuid": "08bd2a31-9b17-4d1b-83ba-b4538a970dee",
    "timestamp": "2022-06-02 16:12:25.242592+00:00"
  }
}
```

To create a webhook, navigate to "Notification settings" in {ref}`Orchest settings <settings>`. The webhook dialog will ask for the following:

1. Webhook URL: Where Orchest sends the HTTP requests to. Activate incoming webhooks on your desired channel (for example: [Slack]) and verify the connection with the "Test" button.
1. Content type: Either `application/json` (default) or `application/x-www-form-urlencoded`.
1. Webhook name (optional): A custom name for your webhook. This is helpful when creating multiple webhooks with similar URLs.
1. Secret (optional): A secret string that you can use to verify the origin of the request (see {ref}`below <secure_webhook>`).

[Slack]: https://slack.com/intl/en-gb/help/articles/115005265063-Incoming-webhooks-for-Slack

(You can read [the source code of the webhook schema]).

[the source code of the webhook schema]: https://github.com/orchest/orchest/blob/v2022.06.2/services/orchest-api/app/app/schema.py#L885-L905

(secure_webhook)=

## Verifying the webhook

The HTTP request of the webhook will contain additional headers that can verify the webhook is coming from Orchest.

`X-Orchest-Event`
: The event type.

`X-Orchest-Delivery`
: UUID of the delivery.

`X-Hub-Signature`
: SHA-256 HMAC digest of the payload.

The following sample code verifies the payload signature is the same as the expected one from the webhook secret:

```python
import hashlib
import hmac
import os


def verify_signature(payload, request_headers):
    """
    Verify that the signature of payload is the same
    as the one expected from the stored webhook secret.
    """
    if not isinstance(body, bytes):
        body = body.encode("utf-8")
    digest = hmac.new(
        os.environ["WEBHOOK_SECRET"].encode("utf-8"),
        body,
        hashlib.sha256
    )
    expected_signature = digest.hexdigest()

    return hmac.compare_digest(
        request_headers["X-Hub-Signature"].encode(),
        expected_signature.encode(),
    )
```
