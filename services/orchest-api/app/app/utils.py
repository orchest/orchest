import logging
import time
import uuid
from collections import ChainMap
from copy import deepcopy
from datetime import datetime
from typing import Container, Dict, Iterable, List, Optional, Tuple, Union

from celery.utils.log import get_task_logger
from flask import current_app
from flask_restx import Model, Namespace
from flask_sqlalchemy import Pagination
from kubernetes import client as k8s_client
from sqlalchemy import or_, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import query, undefer

import app.models as models
from _orchest.internals import config as _config
from _orchest.internals import errors as _errors
from app import errors as self_errors
from app import schema
from app.celery_app import make_celery
from app.connections import db, k8s_core_api
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
    has_customized_jupyter = db.session.query(
        db.session.query(models.JupyterImageBuild).filter_by(status="SUCCESS").exists()
    ).scalar()
    if has_customized_jupyter:
        registry_ip = k8s_core_api.read_namespaced_service(
            _config.REGISTRY, _config.ORCHEST_NAMESPACE
        ).spec.cluster_ip
        return f"{registry_ip}/{_config.JUPYTER_IMAGE_NAME}:latest"
    else:
        return f"orchest/jupyter-server:{CONFIG_CLASS.ORCHEST_VERSION}"


def _set_celery_worker_parallelism_at_runtime(
    worker: str, previous_parallelism: int, new_parallelism: int
) -> bool:
    """Set the parallelism of a celery worker at runtime.

    Args:
        worker: Name of the worker.
        previous_parallelism: Current parallelism level.
        new_parallelism: New parallelism level.

    Returns:
        True if the parallelism level could be changed, False otherwise.
        Only allows to increase parallelism, the reason is that celery
        won't gracefully decrease the parallelism level if it's not
        possible because processes are busy with a task.
    """
    if previous_parallelism is None or new_parallelism is None:
        return False
    if new_parallelism < previous_parallelism:
        return False
    if previous_parallelism == new_parallelism:
        return True

    # We don't query the celery-worker and rely on arguments because the
    # worker might take some time to spawn new processes, leading to
    # race conditions.
    celery = make_celery(current_app)
    worker = f"celery@{worker}"
    celery.control.pool_grow(new_parallelism - previous_parallelism, [worker])
    return True


def _get_worker_parallelism(worker: str) -> int:
    celery = make_celery(current_app)
    worker = f"celery@{worker}"
    stats = celery.control.inspect([worker]).stats()
    return len(stats[worker]["pool"]["processes"])


def _set_job_runs_parallelism_at_runtime(
    previous_parallelism: int, new_parallelism: int
) -> bool:
    return _set_celery_worker_parallelism_at_runtime(
        "worker-jobs",
        previous_parallelism,
        new_parallelism,
    )


def _set_interactive_runs_parallelism_at_runtime(
    previous_parallelism: int, new_parallelism: int
) -> bool:
    return _set_celery_worker_parallelism_at_runtime(
        "worker-interactive",
        previous_parallelism,
        new_parallelism,
    )


class OrchestSettings:
    _cloud = _config.CLOUD

    # Defines default values for all supported configuration options.
    _config_values = {
        "MAX_JOB_RUNS_PARALLELISM": {
            "default": 1,
            "type": int,
            "condition": lambda x: 0 < x <= 25,
            "condition-msg": "within the range [1, 25]",
            # Will return True if it could apply changes on the fly,
            # False otherwise.
            "apply-runtime-changes-function": _set_job_runs_parallelism_at_runtime,
        },
        "MAX_INTERACTIVE_RUNS_PARALLELISM": {
            "default": 1,
            "type": int,
            "condition": lambda x: 0 < x <= 25,
            "condition-msg": "within the range [1, 25]",
            "apply-runtime-changes-function": _set_interactive_runs_parallelism_at_runtime,  # noqa
        },
        "AUTH_ENABLED": {
            "default": False,
            "type": bool,
            "condition": None,
            "apply-runtime-changes-function": lambda prev, new: False,
        },
        "TELEMETRY_DISABLED": {
            "default": False,
            "type": bool,
            "condition": None,
            "apply-runtime-changes-function": lambda prev, new: False,
        },
        "TELEMETRY_UUID": {
            "default": str(uuid.uuid4()),
            "type": str,
            "requires-restart": True,
            "condition": None,
            "apply-runtime-changes-function": lambda prev, new: False,
        },
        "INTERCOM_USER_EMAIL": {
            "default": "johndoe@example.org",
            "type": str,
            "condition": None,
            "apply-runtime-changes-function": lambda prev, new: False,
        },
    }
    _cloud_unmodifiable_config_opts = [
        "TELEMETRY_UUID",
        "TELEMETRY_DISABLED",
        "AUTH_ENABLED",
        "INTERCOM_USER_EMAIL",
    ]

    def __init__(self) -> None:
        """Manages the user orchest settings.

        Uses a collections.ChainMap under the hood to provide fallback
        to default values where needed. And when running with `--cloud`,
        it won't allow you to update config values of the keys defined
        in `self._cloud_unmodifiable_config_opts`.

        Example:
            >>> config = OrchestSettings()
            >>> # Set the current config to a new one.
            >>> config.set(new_config)
            >>> # Save the updated (and automatically validated) config
            >>> # to disk.
            >>> requires_orchest_restart = config.save(flask_app=app)
            >>> # Just an example output.
            >>> requres_orchest_restart
            ... ["MAX_INTERACTIVE_RUNS_PARALLELISM"]

        """
        unmodifiable_config, current_config = self._get_current_configs()
        defaults = {k: val["default"] for k, val in self._config_values.items()}

        self._values = ChainMap(unmodifiable_config, current_config, defaults)

    def as_dict(self) -> dict:
        # Flatten into regular dictionary.
        return dict(self._values)

    def save(self, flask_app=None) -> Optional[List[str]]:
        """Saves the state to the database.

        Args:
            flask_app (flask.Flask): Uses the `flask_app.config` to
                determine whether Orchest needs to be restarted for the
                global config changes to take effect or if some settings
                can be updated at runtime.

        Returns:
            * `None` if no `flask_app` is given.
            * List of changed config options that require an Orchest
              restart to take effect.
            * Empty list otherwise.

        """
        settings_as_dict = self.as_dict()

        # Upsert entries.
        stmt = insert(models.Setting).values(
            [dict(name=k, value={"value": v}) for k, v in settings_as_dict.items()]
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[models.Setting.name], set_=dict(value=stmt.excluded.value)
        )
        db.session.execute(stmt)

        # Delete settings that are not part of the new configuration.
        models.Setting.query.filter(
            models.Setting.name.not_in(list(settings_as_dict.keys()))
        ).delete()

        db.session.commit()

        if flask_app is None:
            return

        return self._apply_runtime_changes(flask_app, settings_as_dict)

    def update(self, d: dict) -> None:
        """Updates the current config values.

        Under the hood it just calls `dict.update` on the current config
        dict.

        Raises:
            TypeError: The values of the dictionary that correspond to
                supported config values have incorrect types.
            ValueError: The values of the dictionary that correspond to
                supported config values have incorrect values. E.g.
                maximum parallelism has to be greater or equal to one.

        """
        try:
            self._validate_dict(d)
        except (TypeError, ValueError) as e:
            current_app.logger.error(
                "Tried to update global Orchest config with incorrect types or values."
            )
            raise e
        else:
            self._values.maps[1].update(d)

    def set(self, d: dict) -> None:
        """Overwrites the current config with the given dict.

        Raises:
            TypeError: The values of the dictionary that correspond to
                supported config values have incorrect types.
            ValueError: The values of the dictionary that correspond to
                supported config values have incorrect values. E.g.
                maximum parallelism has to be greater or equal to one.

        """
        try:
            self._validate_dict(d)
        except (TypeError, ValueError) as e:
            current_app.logger.error(
                "Tried to update global Orchest config with incorrect types or values."
            )
            raise e
        else:
            self._values.maps[1] = d

    def __getitem__(self, key):
        return self._values[key]

    def _apply_runtime_changes(self, flask_app, new: dict) -> None:
        """Updates settings at runtime when possible.

        Changes that can be updated dynamically and do not require a
        restart are applied.

        Args:
            flask_app (flask.Flask): The `flask_app.config` will be
                updated if changing the settings at runtime was
                possible.
            new: Dictionary reflecting the new settings to be applied.

        Returns:
            A list of strings representing the changed configuration
            options that require a restart of Orchest to take effect.

        """
        settings_requiring_restart = []
        for k, val in self._config_values.items():
            # Changes to unmodifiable config options won't take effect
            # anyways and so they should not account towards requiring
            # a restart yes or no.
            if self._cloud and k in self._cloud_unmodifiable_config_opts:
                continue

            apply_f = val["apply-runtime-changes-function"]

            old_val = flask_app.config.get(k)
            new_val = new.get(k)
            if new_val is not None and new_val != old_val:
                could_update = apply_f(old_val, new_val)
                if could_update:
                    flask_app.config[k] = new_val
                else:
                    settings_requiring_restart.append(k)

        return settings_requiring_restart

    def _validate_dict(self, d: dict, migrate=False) -> None:
        """Validates the types and values of the values of the dict.

        Validates whether the types of the values of the given dict
        equal the types of the respective key's values of the
        `self._config_values` and additional key specific rules are
        satisfied, e.g. parallelism > 0.

        Args:
            d: The dictionary to validate the types and values of.
            migrate: If `True`, then the options for which the type
                and/or value are invalidated get assigned their default
                value. However, `self._cloud_unmodifiable_config_opts`
                are never migrated if `self._cloud==True` as that could
                cause authentication to get disabled.

        Note:
            Keys in the given dict that are not in the
            `self._config_values` are not checked.

        """
        for k, val in self._config_values.items():
            try:
                given_val = d[k]
            except KeyError:
                # We let it pass silently because it won't break the
                # application in any way as we will later fall back on
                # default values.
                current_app.logger.debug(
                    f"Missing value for required config option: {k}."
                )
                continue

            if type(given_val) is not val["type"]:
                not_allowed_to_migrate = (
                    self._cloud and k in self._cloud_unmodifiable_config_opts
                )
                if not migrate or not_allowed_to_migrate:
                    given_val_type = type(given_val).__name__
                    correct_val_type = val["type"].__name__
                    raise TypeError(
                        f'{k} has to be a "{correct_val_type}" but "{given_val_type}"'
                        " was given."
                    )

                d[k] = val["default"]

            if val["condition"] is not None and not val["condition"].__call__(
                given_val
            ):
                not_allowed_to_migrate = (
                    self._cloud and k in self._cloud_unmodifiable_config_opts
                )
                if not migrate or not_allowed_to_migrate:
                    raise ValueError(f"{k} has to be {val['condition-msg']}.")

                d[k] = val["default"]

    def _get_current_configs(self) -> Tuple[dict, dict]:
        """Gets the dicts needed to initialize this class.

        Returns:
            (unmodifiable_config, current_config): The first being
                populated in case `self._cloud==True` and taking the
                values of the respective `current_config` values.

        """
        current_config = self._fetch_settings_from_db()

        try:
            # Make sure invalid values are migrated to default values,
            # because the application can not start with invalid values.
            self._validate_dict(current_config, migrate=True)
        except (TypeError, ValueError):
            raise _errors.CorruptedFileError(
                f'Option(s) defined in the global user config ("{self._path}") has'
                + " incorrect type and/or value."
            )

        unmodifiable_config = {}
        if self._cloud:
            for k in self._cloud_unmodifiable_config_opts:
                try:
                    unmodifiable_config[k] = deepcopy(current_config[k])
                except KeyError:
                    # Fall back on default values.
                    ...

        return unmodifiable_config, current_config

    def _fetch_settings_from_db(self) -> dict:
        """Fetches the settings from the database."""

        stored_settings = models.Setting.query.all()
        settings = {}
        for setting in stored_settings:
            settings[setting.name] = setting.value["value"]

        return settings
