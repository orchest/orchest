"""Implements the logic that sends events to analytics.

This is a special case when it comes to notifications modules.
Essentially, there can only be one subscriber of the type
AnalyticsSubscriber, and the actual data like URL and secrets are stored
in the code base since currently the analytics module is shared across
multiple services.

"""
import json
import os

from flask import current_app

from _orchest.internals import analytics
from _orchest.internals import utils as _utils
from app import models
from app import utils as app_utils
from app.connections import db
from app.core.notifications import utils as notification_utils

logger = app_utils.get_logger()


def upsert_analytics_subscriptions() -> None:
    """Makes sure the analytics backend is subscribed to all events.

    Commits to the db.
    """

    # Use an hardcoded uuid to make sure only 1 such subscriber exists,
    # to avoid race conditions.
    uuid = "c9075806-be93-4b87-9d77-9a376d347b3a"
    subscriber = models.AnalyticsSubscriber.query.with_for_update().first()
    if subscriber is None:
        subscriber = models.AnalyticsSubscriber(uuid=uuid)
        db.session.add(subscriber)
        db.session.flush()

    existing_subs = {
        sub.event_type
        for sub in models.Subscription.query.filter(
            models.Subscription.subscriber_uuid == uuid
        ).all()
    }

    event_types = [event_type.name for event_type in models.EventType.query.all()]
    new_subscriptions = []
    for event_type in event_types:
        if event_type not in existing_subs:
            new_subscriptions.append({"event_type": event_type})
    subs = notification_utils.subscription_specs_to_subscriptions(
        uuid, new_subscriptions
    )
    db.session.bulk_save_objects(subs)
    db.session.commit()


def send_test_ping_delivery() -> bool:
    """Used internally for testing, send a ping event.

    Returns:
        True if the delivery was made, False otherwise.
    """
    return analytics.send_event(current_app, analytics.Event.DEBUG_PING, {})


def generate_payload_for_analytics(event: models.Event) -> dict:
    """Creates an analytics module compatible payload.

    Acts as a compatibility layer between orchest-api events and what
    the shared analytics module expects, and also provides some "old"
    fields to the analytics BE, to avoid breaking changes.
    """

    analytics_payload = event.to_notification_payload()

    event_type = analytics_payload["type"]

    if event_type.startswith("project:cron-job:run:pipeline-run:"):
        analytics_payload["run_uuid"] = analytics_payload["project"]["job"]["run"][
            "pipeline_run"
        ]["uuid"]
    elif event_type.startswith("project:one-off-job:pipeline-run:"):
        analytics_payload["run_uuid"] = analytics_payload["project"]["job"][
            "pipeline_run"
        ]["uuid"]

    return analytics_payload


def _augment_job_created_payload(payload: dict) -> None:
    job = models.Job.query.filter(
        models.Job.project_uuid == payload["event_properties"]["project"]["uuid"],
        models.Job.uuid == payload["event_properties"]["project"]["job"]["uuid"],
    ).first()
    if job is None:
        return

    snapshot_path = app_utils.get_job_snapshot_path(
        job.project_uuid,
        job.pipeline_uuid,
        job.uuid,
    )
    if os.path.exists(snapshot_path):
        snapshot_size = _utils.get_directory_size(snapshot_path) / (
            1024**2
        )  # In MBs.
        payload["derived_properties"]["project"]["job"]["snapshot_size"] = snapshot_size
        # Deprecated.
        payload["event_properties"]["snapshot_size"] = snapshot_size
        if "deprecated" not in payload["event_properties"]:
            payload["event_properties"]["deprecated"] = []
        payload["event_properties"]["deprecated"].append("snapshot_size")


def _augment_env_image_build_created_payload(payload: dict) -> None:
    event_properties, derived_props = (
        payload["event_properties"],
        payload["derived_properties"],
    )
    build = models.EnvironmentImageBuild.query.filter(
        models.EnvironmentImageBuild.project_uuid
        == event_properties["project"]["uuid"],
        models.EnvironmentImageBuild.environment_uuid
        == event_properties["project"]["environment"]["uuid"],
        models.EnvironmentImageBuild.image_tag
        == event_properties["project"]["environment"]["image_build"]["image_tag"],
    ).first()
    if build is None:
        return

    env_dir_path = app_utils.get_environment_directory_path(
        build.project_path, build.environment_uuid
    )
    env_properties_path = os.path.join(env_dir_path, "properties.json")
    if os.path.exists(env_properties_path):
        with open(env_properties_path, "r") as env_props_file:
            env_dict = json.load(env_props_file)

            base_image = env_dict["base_image"]
            uses_orchest_base_image = base_image.startswith("orchest/")

            build_properties = event_properties["project"]["environment"]["image_build"]
            build_properties["gpu_support"] = env_dict["gpu_support"]
            build_properties["language"] = env_dict["language"]
            derived_props["project"]["environment"]["image_build"][
                "uses_orchest_base_image"
            ] = uses_orchest_base_image
            if uses_orchest_base_image:
                build_properties["base_image"] = base_image

            # Deprecated.
            event_properties["gpu_support"] = build_properties["gpu_support"]
            event_properties["language"] = build_properties["language"]
            derived_props["uses_orchest_base_image"] = uses_orchest_base_image
            if uses_orchest_base_image:
                event_properties["base_image"] = base_image


def _augment_payload(payload: dict) -> None:
    """Last minute augmentations of an analytics payload.

    Necessary to not introduce breaking changes to the existing
    analytics schema and not having the orchest-api access the file
    system.
    """
    if payload["event_properties"]["type"] in [
        "project:one-off-job:created",
        "project:cron-job:created",
    ]:
        _augment_job_created_payload(payload)
    elif (
        payload["event_properties"]["type"] == "project:environment:image-build:created"
    ):
        _augment_env_image_build_created_payload(payload)


def deliver(delivery_uuid: str) -> None:
    """Delivers an analytics delivery. Will commit to the database.

    If the delivery fails it's rescheduled in the future with a capped
    exponential backoff. This function will commit to the database to
    ensure that each delivery get its own transaction.

    Args:
        delivery_uuid: Delivery to be delivered, the associated
            deliveree must be an AnalyticsSubscriber.

    Raises:
        ValueError: If the associated deliveree isn't an
            AnalyticsSubscriber.

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

    deliveree = models.AnalyticsSubscriber.query.filter(
        models.AnalyticsSubscriber.uuid == delivery.deliveree
    ).first()
    if deliveree is None:
        raise ValueError("Deliveree of delivery isn't of type AnalyticsSubscriber.")

    try:
        payload: analytics.TelemetryData = delivery.notification_payload
        _augment_payload(payload)

        if analytics.send_event(
            current_app, analytics.Event(payload["event_properties"]["type"]), payload
        ):
            delivery.set_delivered()
            db.session.delete(delivery)
    except Exception as e:
        logger.error(e)
        delivery.reschedule()

        # Analytics is subscribed to all events, avoid having an unbound
        # number of said deliveries in case things go wrong with the
        # analytics back-end or if we move away from that.
        if delivery.n_delivery_attempts > 5:
            db.session.delete(delivery)
            logger.info(f"Deleting {delivery_uuid}, couldn't deliver it.")
        else:
            logger.info(f"Rescheduling {delivery_uuid} at {delivery.scheduled_at}.")

    db.session.commit()
