import logging
import os
import re

from flask import jsonify

from _orchest.internals import config as _config

logger = logging.getLogger(__name__)

PROJECT_DIR_PATH = _config.PROJECT_DIR
ALLOWED_ROOTS = [PROJECT_DIR_PATH, "/data"]


def allowed_file(filename):
    """Answers: Is the given file allowed?

    Note:
        Allows all files for now.

    """
    return True


def root_from_request(request):
    root = request.args.get("root", PROJECT_DIR_PATH)

    if root in ALLOWED_ROOTS:
        return root
    else:
        raise ValueError("Received illegal root path.")


def old_new_roots_from_request(request):
    old_root = request.args["oldRoot"]
    new_root = request.args["newRoot"]

    if old_root in ALLOWED_ROOTS and new_root in ALLOWED_ROOTS:
        return [old_root, new_root]
    else:
        raise ValueError("Received illegal root path.")


def find_unique_duplicate_filepath(fp):
    counter = 1
    new_path_fs = "{base} ({counter}){ext}"

    if fp.endswith("/"):
        basename = os.path.basename(fp[:-1])
        ext = ""
        base_no_ext = basename
    else:
        basename = os.path.basename(fp)
        _, ext = os.path.splitext(fp)
        if len(ext) > 0:
            base_no_ext = basename[: -len(ext)]
        else:
            base_no_ext = basename

    # Try to find existing counter ending
    regex = r".*? \((\d+)\)$"
    matches = re.finditer(regex, base_no_ext)

    group_match = None
    for _, match in enumerate(matches, start=1):
        if len(match.group()) > 0:
            group_match = match.group(1)

    # Strip off the (<number>) match
    if group_match is not None:
        base_no_ext = base_no_ext[: -(len(group_match) + 3)]

    while True:
        new_path = os.path.join(
            os.path.abspath(os.path.join(fp, os.pardir)),
            new_path_fs.format(base=base_no_ext, counter=counter, ext=ext),
        )

        if os.path.isfile(new_path) or os.path.isdir(new_path):
            counter += 1
            continue
        else:
            return new_path


def generate_abs_path(path, root, dir, is_dir=False):
    """
    This generates a new absolute path, relative from the `dir`
    """
    return (
        "/" + os.path.relpath(os.path.join(root, path), dir) + ("/" if is_dir else "")
    )


def zipdir(path, ziph):
    # ziph is zipfile handle
    for root, _, files in os.walk(path):
        for file in files:
            ziph.write(
                os.path.join(root, file),
                os.path.relpath(os.path.join(root, file), os.path.join(path, "..")),
            )


def generate_tree(dir, path_filter="/", allowed_file_extensions=[], depth=3):

    if not os.path.isdir(dir):
        return jsonify({"message": "Dir %s not found." % dir}), 404

    # Init structs
    tree = {
        "type": "directory",
        "name": os.path.basename(path_filter[:-1]),
        "path": path_filter,
        "children": [],
    }
    if path_filter == "/":
        tree["root"] = True
    else:
        tree["depth"] = path_filter.count(os.sep) - 1

    dir_nodes = {}

    if path_filter != "/":
        filtered_path = os.path.join(dir, path_filter[1:-1])
    else:
        filtered_path = dir

    dir_nodes[filtered_path] = tree

    dir_depth = dir.count(os.sep)

    logger.debug("Walking %s " % filtered_path)
    for root, dirs, files in os.walk(filtered_path):

        dir_delete_set = set()
        for dirname in dirs:

            dir_path = os.path.join(root, dirname)
            dir_node = {
                "type": "directory",
                "name": dirname,
                "children": [],
                "depth": root.count(os.sep) - dir_depth + 1,
                "path": generate_abs_path(dirname, root, dir, is_dir=True),
            }

            relative_depth = dir_node["depth"] - (path_filter.count(os.sep) - 2)
            if relative_depth > depth:  # Account for filtered_path
                dir_delete_set.add(dirname)

            logger.debug(relative_depth)

            dir_nodes[dir_path] = dir_node
            dir_nodes[root]["children"].append(dir_node)

        # Filter dirs in delete set
        dirs[:] = [d for d in dirs if d not in dir_delete_set]

        for filename in files:

            if (
                len(allowed_file_extensions) == 0
                or filename.split(".")[-1] in allowed_file_extensions
            ):
                file_node = {
                    "type": "file",
                    "name": filename,
                    "path": generate_abs_path(filename, root, dir),
                }

                # this key should always exist
                try:
                    dir_nodes[root]["children"].append(file_node)
                except KeyError as e:
                    logger.error(
                        "Key %s does not exist in dir_nodes %s. Error: %s"
                        % (root, dir_nodes, e)
                    )
                except Exception as e:
                    logger.error("Error: %e" % e)

        # Sort files & directories (directories always go before files)
        if "children" in dir_nodes[root]:
            dir_nodes[root]["children"].sort(
                key=lambda e: {"directory": "a.", "file": "b."}[e["type"]] + e["name"]
            )
    return jsonify(tree)
