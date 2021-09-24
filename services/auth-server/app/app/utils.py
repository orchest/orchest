import datetime
import hashlib
import json

from flask import current_app


def get_hash(path):
    BLOCKSIZE = 8192 * 8
    hasher = hashlib.md5()
    with open(path, "rb") as afile:
        buf = afile.read(BLOCKSIZE)
        while len(buf) > 0:
            hasher.update(buf)
            buf = afile.read(BLOCKSIZE)

    return hasher.hexdigest()


def get_user_conf():
    conf_data = {}

    # configure default value
    conf_data["AUTH_ENABLED"] = False

    try:
        with open("/config/config.json", "r") as f:
            config = json.load(f)

        conf_data.update(config)
    except Exception as e:
        try:
            current_app.logger.debug(e)
        except RuntimeError:
            # Is hit in case the function is called without an
            # application context, e.g. in the `main.py` module.
            import logging

            logger = logging.getLogger(__name__)
            logger.debug(e)

    return conf_data


def set_auth_cache(
    project_uuid_prefix, session_uuid_prefix, requires_authentication, auth_cache
):
    auth_cache["%s-%s" % (project_uuid_prefix, session_uuid_prefix)] = {
        "date": datetime.datetime.now(),
        "requires_authentication": requires_authentication,
    }


def get_auth_cache(
    project_uuid_prefix, session_uuid_prefix, auth_cache, auth_cache_age
):
    key = "%s-%s" % (project_uuid_prefix, session_uuid_prefix)

    if key not in auth_cache:
        return {"status": "missing"}

    if (
        datetime.datetime.now() - auth_cache[key]["date"]
    ).total_seconds() > auth_cache_age:
        return {"status": "expired"}

    return {
        "status": "available",
        "requires_authentication": auth_cache[key]["requires_authentication"],
    }
