#!/usr/bin/env python3

import sys

# Usage: replace.py
# <file_path>
# <replace_token>
# <replace_value|replace_value_path>
# ["file"]
#
# Caveats:
# - only text files
# - assumes utf-8 encoded files
# - assumes LF newlines
# - always replaces all occurences
if __name__ == "__main__":

    file = sys.argv[1]
    replace_token = sys.argv[2]
    replace_value = sys.argv[3]
    is_replace_value_file = (
        True if len(sys.argv) > 4 and sys.argv[4] == "file" else False
    )

    if is_replace_value_file:
        with open(replace_value, "r") as f:
            replace_value = f.read()

    with open(file, "r") as f:
        file_string = f.read()

    print(file_string.replace(replace_token, replace_value), end="", flush=True)
