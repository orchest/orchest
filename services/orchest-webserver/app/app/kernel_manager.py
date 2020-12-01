import os
import logging
import shutil

from app.utils import get_environments, clear_folder
from app.models import Project
from distutils.dir_util import copy_tree
from _orchest.internals import config as _config


def populate_kernels(app, db):

    # check whether all kernels are available in the userdir/.orchest/kernels

    # use database to figure out which kernel directories should exist
    projects = Project.query.all()

    project_uuids = set([project.uuid for project in projects])

    kernels_root_path = os.path.join(app.config["USER_DIR"], ".orchest", "kernels")

    if not os.path.exists(kernels_root_path):
        os.makedirs(kernels_root_path)
    else:
        # clear all the kernel folders
        # without removing the project kernel folders of existing projects as to not
        # disturb the mounted paths
        for filename in os.listdir(kernels_root_path):

            project_folder_path = os.path.join(kernels_root_path, filename)

            if os.path.isdir(project_folder_path):

                # if project exists clear kernel contents
                if filename in project_uuids:

                    clear_folder(project_folder_path)
                else:
                    # if project doesn't exist clear the entire folder to keep
                    # .orchest/kernels tidy
                    shutil.rmtree(project_folder_path)

    for project in projects:

        environments = get_environments(project.uuid)
        kernels_dir_path = os.path.join(
            app.config["USER_DIR"], ".orchest", "kernels", project.uuid
        )

        # remove all kernels
        if not os.path.exists(kernels_dir_path):
            os.makedirs(kernels_dir_path)

        # kernel.json template
        kernel_template_dir = os.path.join(
            app.config["RESOURCE_DIR"], "kernels", "docker"
        )

        kernel_json_template_path = os.path.join(kernel_template_dir, "kernel.json")

        try:
            with open(kernel_json_template_path, "r") as f:
                kernel_json_template = f.read()
        except Exception as e:
            logging.info(
                "Error reading kernel.json at path %s. Error: %s"
                % (kernel_json_template_path, e)
            )
            raise e

        # create kernel_dirs
        for environment in environments:

            kernel_name = _config.KERNEL_NAME.format(environment_uuid=environment.uuid)

            image_name = _config.ENVIRONMENT_IMAGE_NAME.format(
                project_uuid=project.uuid, environment_uuid=environment.uuid
            )

            kernel_dir_path = os.path.join(kernels_dir_path, kernel_name)

            os.makedirs(kernel_dir_path)

            # copy kernel logo resources
            copy_tree(kernel_template_dir, kernel_dir_path)

            # write filled template kernel.json
            filled_kernel_json = (
                kernel_json_template.replace("{image_name}", image_name)
                .replace("{language}", environment.language)
                .replace("{display_name}", environment.name)
            )

            kernel_json_path = os.path.join(kernel_dir_path, "kernel.json")

            # override kernel.json template
            try:
                with open(kernel_json_path, "w") as f:
                    f.write(filled_kernel_json)
            except Exception as e:
                logging.info(
                    "Error writing kernel.json at path %s. Error: %s"
                    % (kernel_json_path, e)
                )
                raise e

        # copy launch_docker.py
        launch_docker_path = os.path.join(
            app.config["RESOURCE_DIR"], "kernels", "launch_docker.py"
        )
        launch_docker_dest_path = os.path.join(kernels_dir_path, "launch_docker.py")

        os.system('cp "%s" "%s"' % (launch_docker_path, launch_docker_dest_path))
