from typing import List

from app import models, utils

logger = utils.get_logger()


def subscription_specs_to_subscriptions(
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
                raise ValueError(f"Missing 'event_type' for subscription '{key}'.")
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
