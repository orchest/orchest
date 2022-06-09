"""Module that covers the functionality related to notifications.

A subscriber and its subscriptions are currently treated as a single
block, meaning that a subscriber is created with a given set of
subscriptions, which cannot later be altered. If wished for, this can be
easily changed, since the db schema allows to do so.

"""
import datetime
from typing import List, Optional

from sqlalchemy.orm import noload

from app import models
from app import utils as app_utils
from app.connections import db
from app.core.notifications import analytics, webhooks

logger = app_utils.get_logger()


def get_subscribable_events() -> List[dict]:
    event_types = models.EventType.query.all()
    res = []
    for event_type in event_types:
        name = event_type.name
        optional_filters = []

        if name.startswith("project:"):
            optional_filters.append(["project_uuid"])
        if name.startswith("project:cron-job:") or name.startswith(
            "project:one-off-job:"
        ):
            optional_filters.append(["project_uuid", "job_uuid"])
        res.append({"name": name, "optional_filters": optional_filters})

    return res


def get_subscribers_subscribed_to_event(
    event_type: str,
    project_uuid: Optional[str] = None,
    job_uuid: Optional[str] = None,
) -> List[models.Subscriber]:
    """Gets all subscribers subscribed to an event.

    When only event_type is passed, only subscriptions that do not
    specify a given project or job are considered. When project or job
    uuid are specified this query will consider both subscriptions that
    don't specify a project/job and those who do.

    Args:
        event_type: Event type of the subscription.
        project_uuid: Allows to specify that the event is related to a
            specific project.
        job_uuid: Allows to specify that the event is related to a
            specific job. If specified, project_uuid should be specified
            as well.
    Returns:
        List of subscribers that are subscribed to the given event.

    Raises:
        ValueError if the job_uuid is specified but project_uuid is not.
    """
    notified_subscribers_ids = db.session.query(
        models.Subscription.subscriber_uuid
    ).filter(
        models.Subscription.event_type == event_type,
        # Don't capture subscriptions that specify job or project.
        models.Subscription.type == "globally_scoped_subscription",
    )

    if project_uuid is not None:
        proj_specific_subs = db.session.query(
            models.ProjectSpecificSubscription.subscriber_uuid
        ).filter(
            models.ProjectJobSpecificSubscription.event_type == event_type,
            models.ProjectJobSpecificSubscription.project_uuid == project_uuid,
        )
        notified_subscribers_ids = notified_subscribers_ids.union(proj_specific_subs)

    if job_uuid is not None:
        if project_uuid is None:
            raise ValueError("If job_uuid is defind project_uuid must be as well.")
        proj_job_specific_subs = db.session.query(
            models.ProjectJobSpecificSubscription.subscriber_uuid
        ).filter(
            models.ProjectJobSpecificSubscription.event_type == event_type,
            models.ProjectJobSpecificSubscription.project_uuid == project_uuid,
            models.ProjectJobSpecificSubscription.job_uuid == job_uuid,
        )
        notified_subscribers_ids = notified_subscribers_ids.union(
            proj_job_specific_subs
        )

    notified_subscribers = (
        models.Subscriber.query.options(noload(models.Subscriber.subscriptions))
        .filter(models.Subscriber.uuid.in_(notified_subscribers_ids.subquery()))
        .all()
    )

    return notified_subscribers


def process_notifications_deliveries_task() -> None:
    logger.info("Processing notifications deliveries")

    delivery_filter = [
        models.Delivery.status.in_(["SCHEDULED", "RESCHEDULED"]),
        models.Delivery.scheduled_at <= datetime.datetime.now(datetime.timezone.utc),
    ]

    # Note that we don't select for update here, said locking will
    # happen on a single delivery basis.
    webhook_deliveries = (
        (db.session.query(models.Delivery.uuid))
        .join(models.Webhook, models.Webhook.uuid == models.Delivery.deliveree)
        .filter(*delivery_filter)
        .order_by(models.Delivery.scheduled_at)
        .all()
    )

    logger.info(f"Found {len(webhook_deliveries)} webhook deliveries to deliver.")

    for delivery in webhook_deliveries:
        try:
            webhooks.deliver(delivery.uuid)
        # Don't let failures affect other deliveries.
        except Exception as e:
            logger.error(e)

    analytics_deliveries = (
        (db.session.query(models.Delivery.uuid))
        .join(
            models.AnalyticsSubscriber,
            models.AnalyticsSubscriber.uuid == models.Delivery.deliveree,
        )
        .filter(*delivery_filter)
        .order_by(models.Delivery.scheduled_at)
        .all()
    )

    logger.info(f"Found {len(analytics_deliveries)} analytics deliveries to deliver.")

    for delivery in analytics_deliveries:
        try:
            analytics.deliver(delivery.uuid)
        # Don't let failures affect other deliveries.
        except Exception as e:
            logger.error(e)
