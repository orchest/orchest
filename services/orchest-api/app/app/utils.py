from datetime import datetime
from typing import Dict

from flask_restplus import Model, Namespace

from app import schema
from app.connections import db


def register_schema(api: Namespace) -> Namespace:
    all_models = [
        getattr(schema, attr)
        for attr in dir(schema)
        if isinstance(getattr(schema, attr), Model)
    ]

    # TODO: only a subset of all models should be registered.
    for model in all_models:
        api.add_model(model.name, model)

    return api


def update_status_db(
    status_update: Dict[str, str], model: Model, filter_by: Dict[str, str]
) -> None:
    """Updates the status attribute of particular entry in the database.

    Args:
        status_update: The new status {'status': 'STARTED'}.
        model: Database model to update the status of.
        filter_by: The filter to query the exact resource for which to
            update its status.

    """
    data = status_update

    if data["status"] == "STARTED":
        data["started_time"] = datetime.fromisoformat(data["started_time"])
    elif data["status"] in ["SUCCESS", "FAILURE"]:
        data["finished_time"] = datetime.fromisoformat(data["finished_time"])

    res = model.query.filter_by(**filter_by).update(data)

    if res:
        db.session.commit()

    return
