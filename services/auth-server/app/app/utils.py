import datetime
import hashlib


def get_hash(path):
    BLOCKSIZE = 8192 * 8
    hasher = hashlib.md5()
    with open(path, "rb") as afile:
        buf = afile.read(BLOCKSIZE)
        while len(buf) > 0:
            hasher.update(buf)
            buf = afile.read(BLOCKSIZE)

    return hasher.hexdigest()


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
