import logging
import time
from datetime import datetime
from typing import Container, Dict, Iterable, Optional, Union

from celery.utils.log import get_task_logger
from flask import current_app
from flask_restx import Model, Namespace
from flask_sqlalchemy import Pagination
from kubernetes import client as k8s_client
from sqlalchemy import desc, or_, text
from sqlalchemy.orm import query, undefer

import app.models as models
from _orchest.internals import config as _config
from app import errors as self_errors
from app import schema
from app.connections import k8s_core_api
from config import CONFIG_CLASS


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

    An entity that has already reached an end state, i.e. FAILURE,
    SUCCESS, ABORTED, will not be updated. This is to avoid race
    conditions.

    Args:
        status_update: The new status {'status': 'STARTED'}.
        model: Database model to update the status of. Assumed to have a
            status column mapping to a string.
        filter_by: The filter to query the exact resource for which to
            update its status.

    Returns:
        True if at least 1 row was updated, false otherwise.

    """
    data = status_update

    if data["status"] == "STARTED":
        data["started_time"] = datetime.fromisoformat(data["started_time"])
    elif data["status"] in ["SUCCESS", "FAILURE"]:
        data["finished_time"] = datetime.fromisoformat(data["finished_time"])

    res = (
        model.query.filter_by(**filter_by)
        .filter(
            # This implies that an entity cannot be furtherly updated
            # once it reaches an "end state", i.e. FAILURE, SUCCESS,
            # ABORTED. This helps avoiding race conditions given by the
            # orchest-api and a celery task trying to update the same
            # entity concurrently, for example when a task is aborted.
            model.status.in_(["PENDING", "STARTED"])
        )
        .update(
            data,
            # https://docs.sqlalchemy.org/en/14/orm/session_basics.html#orm-expression-update-delete
            # The default "evaluate" is not reliable, because depending
            # on the complexity of the model sqlalchemy might not have a
            # working implementation, in that case it will raise an
            # exception. From the docs:
            # For UPDATE or DELETE statements with complex criteria, the
            # 'evaluate' strategy may not be able to evaluate the
            # expression in Python and will raise an error.
            synchronize_session="fetch",
        )
    )

    return bool(res)


def get_proj_pip_env_variables(project_uuid: str, pipeline_uuid: str) -> Dict[str, str]:
    """

    Args:
        project_uuid:
        pipeline_uuid:

    Returns:
        Environment variables resulting from the merge of the project
        and pipeline environment variables, giving priority to pipeline
        variables, e.g. they override project variables.
    """
    project_env_vars = (
        models.Project.query.options(undefer(models.Project.env_variables))
        .filter_by(uuid=project_uuid)
        .one()
        .env_variables
    )
    pipeline_env_vars = (
        models.Pipeline.query.options(undefer(models.Pipeline.env_variables))
        .filter_by(project_uuid=project_uuid, uuid=pipeline_uuid)
        .one()
        .env_variables
    )
    return {**project_env_vars, **pipeline_env_vars}


def get_logger() -> logging.Logger:
    try:
        return current_app.logger
    except Exception:
        pass
    return get_task_logger(__name__)


def page_to_pagination_data(pagination: Pagination) -> dict:
    """Pagination to a dictionary containing data of interest.

    Essentially a preprocessing step before marshalling.
    """
    return {
        "has_next_page": pagination.has_next,
        "has_prev_page": pagination.has_prev,
        "next_page_num": pagination.next_num,
        "prev_page_num": pagination.prev_num,
        "items_per_page": pagination.per_page,
        "items_in_this_page": len(pagination.items),
        "total_items": pagination.total,
        "total_pages": pagination.pages,
    }


def wait_for_pod_status(
    name: str,
    namespace: str,
    expected_statuses: Union[Container[str], Iterable[str]],
    max_retries: Optional[int] = 100,
) -> None:
    """Waits for a pod to get to one of the expected statuses.

    Safe to use when the pod doesn't exist yet, e.g. because it's being
    created.

    Args:
        name: name of the pod
        namespace: namespace of the pod
        expected_statuses: One of the statuses that the pod is expected
            to reach. Upon reaching one of these statuses the function
            will return. Possiblie entries are: Pending, Running,
            Succeeded, Failed, Unknown, which are the possible values
            of pod.status.phase.
        max_retries: Max number of times to poll, 1 second per retry. If
            None, the function will poll indefinitely.

    Raises:
        PodNeverReachedExpectedStatusError:

    """

    while max_retries is None or max_retries > 0:
        max_retries = max_retries - 1
        try:
            resp = k8s_core_api.read_namespaced_pod(name=name, namespace=namespace)
        except k8s_client.ApiException as e:
            if e.status != 404:
                raise
            time.sleep(1)
        else:
            status = resp.status.phase
            if status in expected_statuses:
                break
        time.sleep(1)
    else:
        raise self_errors.PodNeverReachedExpectedStatusError()


def fuzzy_filter_non_interactive_pipeline_runs(
    query: query,
    fuzzy_filter: str,
) -> query:

    fuzzy_filter = fuzzy_filter.lower().strip().split()
    # Quote terms to avoid operators like ! leading to syntax errors and
    # to avoid funny injections.
    fuzzy_filter = [f"''{token}'':*" for token in fuzzy_filter]
    fuzzy_filter = " & ".join(fuzzy_filter)
    # sqlalchemy is erroneously considering the query created through
    # func.to_tsquery invalid.
    fuzzy_filter = f"to_tsquery('simple', '{fuzzy_filter}')"

    filters = [
        models.NonInteractivePipelineRun._NonInteractivePipelineRun__text_search_vector.op(  # noqa
            "@@"
        )(
            text(fuzzy_filter)
        ),
    ]
    query = query.filter(or_(*filters))

    return query


def get_jupyter_server_image_to_use() -> str:
    custom_image = (
        models.JupyterImage.query.filter(
            models.JupyterImage.marked_for_removal.is_(False),
            # Only allow an image that matches this orchest cluster
            # version.
            models.JupyterImage.base_image_version == CONFIG_CLASS.ORCHEST_VERSION,
        )
        .order_by(desc(models.JupyterImage.tag))
        .first()
    )

    if custom_image is not None:
        registry_ip = k8s_core_api.read_namespaced_service(
            _config.REGISTRY, _config.ORCHEST_NAMESPACE
        ).spec.cluster_ip
        return f"{registry_ip}/{_config.JUPYTER_IMAGE_NAME}:{custom_image.tag}"
    else:
        return f"orchest/jupyter-server:{CONFIG_CLASS.ORCHEST_VERSION}"
