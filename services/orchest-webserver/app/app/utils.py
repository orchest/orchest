import json
import os
import hashlib
import random
import string
import logging
import uuid
import tarfile
import io
import docker

from app.models import Image, Commit, Pipeline, Project


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
            conf_data = json.load(f)
    except Exception as e:
        logging.debug(e)

    return conf_data


def get_user_conf_raw():
    try:
        with open("/config/config.json", "r") as f:
            return f.read()
    except Exception as e:
        logging.debug(e)


def save_user_conf_raw(config):
    try:
        with open("/config/config.json", "w") as f:
            f.write(config)
    except Exception as e:
        logging.debug(e)


def get_synthesized_images(language=None):

    synthesized_images = []

    # add base images
    if language is not None:
        images = Image.query.filter(Image.language == language).all()
    else:
        images = Image.query.all()

    image_names = [image.name for image in images]

    image_languages = []
    image_language_dict = {}

    for image in images:
        image_language_dict[image.name] = image.language
        image_languages.append(image.language)

    synthesized_images += image_names

    # add commits (notice, languages are automatically filtered due to
    # dependence on base images)
    commits = Commit.query.filter(Commit.base_image.in_(image_names)).all()
    commit_image_names = [
        "%s:%s" % (commit.base_image, commit.tag) for commit in commits
    ]

    synthesized_images += commit_image_names

    # get commit language by using base image language (commits inherit language
    # from base image)
    image_languages += [image_language_dict[commit.base_image] for commit in commits]

    return synthesized_images, image_languages


def tar_from_path(path, filename):

    tmp_file_path = os.path.join("/tmp", str(uuid.uuid4()))
    tar = tarfile.open(tmp_file_path, "x")

    with open(path, "rb") as f:

        info = tarfile.TarInfo(filename)

        f.seek(0, io.SEEK_END)
        info.size = f.tell()
        f.seek(0, io.SEEK_SET)

        tar.addfile(info, f)
        tar.close()

    with open(tmp_file_path, "rb") as in_file:
        data = in_file.read()

    # remove tmp file
    os.remove(tmp_file_path)

    return data


def remove_dir_if_empty(path):
    if os.path.isdir(path) and not os.listdir(path):
        os.system("rm -r %s" % (path))


def pipeline_uuid_to_path(pipeline_uuid, project_uuid):
    pipeline = (
        Pipeline.query.filter(Pipeline.uuid == pipeline_uuid)
        .filter(Pipeline.project_uuid == project_uuid)
        .first()
    )
    if pipeline is not None:
        return pipeline.path
    else:
        return None


def project_uuid_to_path(project_uuid):
    project = Project.query.filter(Project.uuid == project_uuid).first()
    if project is not None:
        return project.path
    else:
        return None


def name_to_tag(name):

    name = str(name).lower()

    # lowercase is enforced because of Jupyter kernel names automatically
    # becoming lowercase

    # According to Docker's website:
    # A tag name must be valid ASCII and
    # may contain lowercase and
    # uppercase letters, digits, underscores, periods and dashes.
    # A tag name may not start with a period or a dash and
    # may contain a maximum of 128 characters.

    # replace all spaces by dashes
    name = name.replace(" ", "-")

    allowed_symbols = set(
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-"
    )

    name = "".join([char if char in allowed_symbols else "-" for char in list(name)])

    while len(name) > 0 and name[0] in set(".-"):
        name = name[1:]

    return name[0:128]


def find_pipelines_in_dir(path, relative_to=None):

    ignore_dirs = [".ipynb_checkpoints"]

    pipelines = []

    if os.path.isdir(path):
        for root, dirs, files in os.walk(path):

            dirs[:] = [d for d in dirs if d not in ignore_dirs]

            for fName in files:
                if fName.endswith(".orchest"):
                    if relative_to is not None:
                        if relative_to.endswith("/"):
                            relative_to = relative_to[:-1]

                        root = root.replace(relative_to, "")

                    pipelines.append(os.path.join(root, fName))

    return pipelines


def write_config(app, key, value):

    try:
        conf_json_path = "/config/config.json"

        if not os.path.isfile(conf_json_path):
            os.system("touch " + conf_json_path)

        with open(conf_json_path, "r") as f:
            try:
                conf_data = json.load(f)
            except Exception as e:
                print("JSON read error: %s" % e)
                conf_data = {}

            conf_data[key] = value

            app.config.update(conf_data)
        with open(conf_json_path, "w") as f:
            try:
                json.dump(conf_data, f)
            except Exception as e:
                logging.debug(e)
    except Exception as e:
        logging.debug(e)

    # always set rw permissions on file
    os.system("chmod o+rw " + conf_json_path)
