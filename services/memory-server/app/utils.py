import json
from typing import Union


def _parse_string_memory_size(memory_size: Union[str, int]) -> int:
    """Converts string description of memory size to number of bytes

    Allowable inputs are an integer or a string which respects the regex
    "^\d+(\.\d+)?\s*(KB|MB|GB)$".
    """
    # If an integer is given, then it is assumed to be the number of
    # bytes.
    if isinstance(memory_size, int):
        return memory_size

    conversion = {"KB": 1000, "MB": 1000 ** 2, "GB": 1000 ** 3}
    size, unit = memory_size[:-2], memory_size[-2:]
    size = int(float(size) * conversion[unit])

    return size


def get_store_memory_size(pipeline_definition_path: str):
    """Gets the specified memory size from the pipeline definition."""
    with open(pipeline_definition_path, "r") as f:
        description = json.load(f)

    mem_size = description["settings"].get("data_passing_memory_size", 1000 ** 3)

    return _parse_string_memory_size(mem_size)
