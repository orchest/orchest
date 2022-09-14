from __future__ import annotations

import datetime
import hashlib
import os
from typing import Dict, TypedDict, Union

PathType = Union[str, bytes, os.PathLike]


class _InnerAuthCache(TypedDict):
    date: datetime.datetime
    requires_authentication: bool


_AuthCacheDictionary = Dict[str, _InnerAuthCache]


def get_hash(path: PathType) -> str:
    BLOCKSIZE = 8192 * 8
    hasher = hashlib.md5()
    with open(path, "rb") as afile:
        buf = afile.read(BLOCKSIZE)
        while len(buf) > 0:
            hasher.update(buf)
            buf = afile.read(BLOCKSIZE)

    return hasher.hexdigest()


def set_auth_cache(
    project_uuid_prefix: str,
    session_uuid_prefix: str,
    requires_authentication: bool,
    auth_cache: _AuthCacheDictionary,
) -> None:
    auth_cache["%s-%s" % (project_uuid_prefix, session_uuid_prefix)] = {
        "date": datetime.datetime.now(),
        "requires_authentication": requires_authentication,
    }


def get_auth_cache(
    project_uuid_prefix: str,
    session_uuid_prefix: str,
    auth_cache: _AuthCacheDictionary,
    auth_cache_age: int,
) -> Dict[str, str | bool]:
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
