"""Module that covers the functionality related to notifications.

A subscriber and its subscriptions are currently treated as a single
block, meaning that a subscriber is created with a given set of
subscriptions, which cannot later be altered. If wished for, this can be
easily changed, since the db schema allows to do so.

"""
from typing import List, Optional

from sqlalchemy.orm import noload

from app import models, utils
from app.connections import db

logger = utils.get_logger()


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


def _subscription_specs_to_subscriptions(
    subscriber_uuid: str, subscriptions: List[dict]
) -> List[models.Subscription]:
    subs_keys = set()
    subscription_objects = []
    for sub in subscriptions:
        key = "|".join([f"{key}:{sub[key]}" for key in sorted(sub.keys())])
        if key not in subs_keys:
            subs_keys.add(key)
            event_type = sub.get("event_type")
            project_uuid = sub.get("project_uuid")
            job_uuid = sub.get("job_uuid")
            if event_type is None:
                raise ValueError("Missing 'event_type'.")
            if project_uuid is not None:
                if job_uuid is None:
                    subscription_objects.append(
                        models.ProjectSpecificSubscription(
                            subscriber_uuid=subscriber_uuid,
                            event_type=sub["event_type"],
                            project_uuid=project_uuid,
                        )
                    )
                else:
                    subscription_objects.append(
                        models.ProjectJobSpecificSubscription(
                            subscriber_uuid=subscriber_uuid,
                            event_type=sub["event_type"],
                            project_uuid=project_uuid,
                            job_uuid=job_uuid,
                        )
                    )
            elif job_uuid is not None:
                raise ValueError(
                    "Must specify 'project_uuid' if job_uuid is 'specified'."
                )
            else:
                subscription_objects.append(
                    models.Subscription(
                        subscriber_uuid=subscriber_uuid,
                        event_type=sub["event_type"],
                    )
                )
    return subscription_objects


def create_subscriber(subscriptions: List[dict]) -> models.Subscriber:
    """Creates a subscriber entry in the database, does not commit.

    This is a placeholder for future "real" subscribers.
    """
    if not subscriptions:
        raise ValueError("A subscriber must have at least a subscription.")

    subscriber = models.Subscriber()
    db.session.add(subscriber)
    # To avoid FK errors and to force sqlalchemy to generate the
    # subscriber uuid.
    db.session.flush()
    subs = _subscription_specs_to_subscriptions(subscriber.uuid, subscriptions)
    db.session.bulk_save_objects(subs)
    return subscriber


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
