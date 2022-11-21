"""Applying a yaml file, like `kubectl apply`.

Pretty much a copy-paste from:
https://github.com/kubernetes-client/python/blob/master/kubernetes/utils/create_from_yaml.py

We just changed things to support:
    - Replacing an object
        - Create an object if it doesn't exist yet
        - Compatible with `metadata.resourceVersion`

"""

import json
import os

import click
import yaml
from kubernetes import client
from kubernetes.utils.create_from_yaml import (
    LOWER_OR_NUM_FOLLOWED_BY_UPPER_RE,
    UPPER_FOLLOWED_BY_LOWER_RE,
    FailToCreateError,
    create_from_dict,
    create_from_yaml_single_item,
)

create_from_dict = create_from_dict


def replace_from_yaml(
    k8s_client,
    yaml_file=None,
    yaml_objects=None,
    verbose=False,
    namespace="default",
    **kwargs
):
    """
    Copy-paste from `kubernetes.utils.create_from_yaml`
    """

    def replace_with(objects):
        failures = []
        k8s_objects = []
        for yml_document in objects:
            if yml_document is None:
                continue
            try:
                replaced = replace_from_dict(
                    k8s_client, yml_document, verbose, namespace=namespace, **kwargs
                )
                k8s_objects.append(replaced)
            except FailToCreateError as failure:
                failures.extend(failure.api_exceptions)
        if failures:
            raise FailToCreateError(failures)
        return k8s_objects

    if yaml_objects:
        yml_document_all = yaml_objects
        return replace_with(yml_document_all)
    elif yaml_file:
        with open(os.path.abspath(yaml_file)) as f:
            yml_document_all = yaml.safe_load_all(f)
            return replace_with(yml_document_all)
    else:
        raise ValueError(
            "One of `yaml_file` or `yaml_objects` arguments must be provided"
        )


def replace_from_dict(k8s_client, data, verbose=False, namespace="default", **kwargs):
    """
    Copy-paste from `kubernetes.utils.create_from_dict`
    """
    # If it is a list type, will need to iterate its items
    api_exceptions = []
    k8s_objects = []

    if "List" in data["kind"]:
        # Could be "List" or "Pod/Service/...List"
        # This is a list type. iterate within its items
        kind = data["kind"].replace("List", "")
        for yml_object in data["items"]:
            # Mitigate cases when server returns a xxxList object
            # See kubernetes-client/python#586
            if kind != "":
                yml_object["apiVersion"] = data["apiVersion"]
                yml_object["kind"] = kind
            try:
                replaced = replace_from_yaml_single_item(
                    k8s_client, yml_object, verbose, namespace=namespace, **kwargs
                )
                k8s_objects.append(replaced)
            except client.rest.ApiException as api_exception:
                api_exceptions.append(api_exception)
    else:
        # This is a single object. Call the single item method
        try:
            replaced = replace_from_yaml_single_item(
                k8s_client, data, verbose, namespace=namespace, **kwargs
            )
            k8s_objects.append(replaced)
        except client.rest.ApiException as api_exception:
            api_exceptions.append(api_exception)

    # In case we have exceptions waiting for us, raise them
    if api_exceptions:
        raise FailToCreateError(api_exceptions)

    return k8s_objects


def replace_from_yaml_single_item(k8s_client, yml_object, verbose=False, **kwargs):
    """
    Changed from `kubernetes.utils.create_from_yaml_single_item`:
        Checks whether the object already exists in the cluster, if it
        does not then it is created, else it is replaced by
        `yml_object`.

    """

    def get_from_yaml_single_item(k8s_api, kind, name):
        nonlocal yml_object

        # Expect the user to use namespaced objects more often
        if hasattr(k8s_api, "list_namespaced_{0}".format(kind)):
            ns = yml_object["metadata"]["namespace"]
            resp = getattr(k8s_api, "list_namespaced_{0}".format(kind))(namespace=ns)
        else:
            kwargs.pop("namespace", None)
            resp = getattr(k8s_api, "list_{0}".format(kind))()

        for item in resp.items:
            if item.metadata.name == name:
                return item

        return None

    group, _, version = yml_object["apiVersion"].partition("/")
    if version == "":
        version = group
        group = "core"
    # Take care for the case e.g. api_type is "apiextensions.k8s.io"
    # Only replace the last instance
    group = "".join(group.rsplit(".k8s.io", 1))
    # convert group name from DNS subdomain format to
    # python class name convention
    group = "".join(word.capitalize() for word in group.split("."))
    fcn_to_call = "{0}{1}Api".format(group, version.capitalize())
    k8s_api = getattr(client, fcn_to_call)(k8s_client)
    # Replace CamelCased action_type into snake_case
    kind = yml_object["kind"]
    kind = UPPER_FOLLOWED_BY_LOWER_RE.sub(r"\1_\2", kind)
    kind = LOWER_OR_NUM_FOLLOWED_BY_UPPER_RE.sub(r"\1_\2", kind).lower()

    # Without it we can't do replace-like behavior.
    if "name" not in yml_object["metadata"]:
        raise ValueError("Object must define 'metadata.name'")
    else:
        name = yml_object["metadata"]["name"]

    try:
        existing_item = get_from_yaml_single_item(k8s_api, kind, name)
    except Exception:
        existing_item = None

    if existing_item is None:
        return create_from_yaml_single_item(
            k8s_client, yml_object, verbose=False, **kwargs
        )

    # Information we need when doing a replace. Article explaining the
    # need for `resourceVersion`:
    # https://www.alibabacloud.com/blog/understanding-openkruise-kubernetes-resource-update-mechanisms_596718
    kwargs["name"] = name
    yml_object["metadata"]["resourceVersion"] = existing_item.metadata.resource_version

    # Expect the user to replace namespaced objects more often
    if hasattr(k8s_api, "replace_namespaced_{0}".format(kind)):
        # Decide which namespace we are going to put the object in,
        # if any
        if "namespace" in yml_object["metadata"]:
            namespace = yml_object["metadata"]["namespace"]
            kwargs["namespace"] = namespace
        resp = getattr(k8s_api, "replace_namespaced_{0}".format(kind))(
            body=yml_object, **kwargs
        )
    else:
        kwargs.pop("namespace", None)
        resp = getattr(k8s_api, "replace_{0}".format(kind))(body=yml_object, **kwargs)
    if verbose:
        msg = "{0} replaced.".format(kind)
        if hasattr(resp, "status"):
            msg += " status='{0}'".format(str(resp.status))
        print(msg)
    return resp


def has_click_context() -> bool:
    return click.get_current_context(silent=True) is not None


def echo(*args, **kwargs) -> None:
    """Wrapped `click.echo`.

    Note:
        Will do nothing in case the current CLI command is invoked with
        the `--json` flag.

    """
    if os.getenv("SILENCE_OUTPUT", "false") == "true":
        return

    click_ctx = click.get_current_context(silent=True)

    if click_ctx is None:
        return click.echo(*args, **kwargs)

    json_flag = click_ctx.params.get("json_flag")
    if json_flag is not None and json_flag:
        return
    else:
        return click.echo(*args, **kwargs)


JECHO_CALLS = 0


def jecho(*args, **kwargs) -> None:
    """JSON echo."""
    # Invoking `jecho` multiple times within one CLI invocation would
    # mean that the final output is not JSON parsable.
    global JECHO_CALLS
    assert JECHO_CALLS == 0, "`jecho` should only be called once per CLI invocation."
    JECHO_CALLS += 1

    message = kwargs.get("message")
    if message is not None:
        kwargs["message"] = json.dumps(message, sort_keys=True, indent=True)
    else:
        if args and args[0] is not None:
            args = (json.dumps(args[0], sort_keys=True, indent=True), *args[1:])
    return click.echo(*args, **kwargs)  # type: ignore
