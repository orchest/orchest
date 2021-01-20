import pytest

from app import spec


@pytest.mark.parametrize(
    ("self", "other", "overwrite", "expected"),
    [
        ({"a": 1}, {"a": 2}, True, {"a": 2}),
        ({"a": 1}, {"a": 2}, False, {"a": 2}),
        ({"a": [1]}, {"a": [2]}, True, {"a": [2]}),
        ({"a": [1]}, {"a": [2]}, False, {"a": [1, 2]}),
        (
            {"a": {"b": 2}, "c": [3]},
            {"a": {"b": "b"}, "c": [3]},
            False,
            {"a": {"b": "b"}, "c": [3, 3]},
        ),
        (
            {"a": {"b": 2}, "c": [3]},
            {"a": {"b": "b"}},
            False,
            {"a": {"b": "b"}, "c": [3]},
        ),
    ],
    ids=[
        "no-list-overwite",
        "no-list-add",
        "list-overwrite",
        "list-add",
        "nested-add",
        "nested-subset",
    ],
)
def test_inject_dict(self, other, overwrite, expected):
    spec.inject_dict(self, other, overwrite=overwrite)
    assert self == expected


def test_filter_container_config():
    filter = {"nested": ["a", "b"]}
    config = {
        "top-level-1": {
            "nested": "a",
            "info": {},
        },
        "top-level-2": {
            "nested": "b",
            "info": {},
        },
        "top-level-3": {
            "nested": "c",
            "info": {},
        },
    }

    ans = {
        "top-level-1": {
            "nested": "a",
            "info": {},
        },
        "top-level-2": {
            "nested": "b",
            "info": {},
        },
    }

    assert spec.filter_container_config(config, filter) == ans
