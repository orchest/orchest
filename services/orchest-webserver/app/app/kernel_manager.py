import os
from distutils.dir_util import copy_tree

from _orchest.internals import config as _config
from app.utils import clear_folder, get_environments


def cleanup_kernel(app, project_uuid):

    kernels_root_path = os.path.join(app.config["USER_DIR"], ".orchest", "kernels")

    # clear all project kernel folder
    # without removing the project kernel folder
    # disturb the mounted paths
    kernels_dir_path = os.path.join(kernels_root_path, project_uuid)
    if os.path.isdir(kernels_dir_path):
        clear_folder(kernels_dir_path)


def populate_kernels(app, db, project_uuid):

    # cleanup old kernels
    cleanup_kernel(app, project_uuid)

    kernels_root_path = os.path.join(app.config["USER_DIR"], ".orchest", "kernels")
    if not os.path.exists(kernels_root_path):
        os.makedirs(kernels_root_path, exist_ok=True)

    kernels_dir_path = os.path.join(kernels_root_path, project_uuid)
    if not os.path.exists(kernels_dir_path):
        os.makedirs(kernels_dir_path, exist_ok=True)

    # kernel.json template
    kernel_template_dir = os.path.join(app.config["RESOURCE_DIR"], "kernels", "docker")

    kernel_json_template_path = os.path.join(kernel_template_dir, "kernel.json")
    try:
        with open(kernel_json_template_path, "r") as f:
            kernel_json_template = f.read()
    except Exception as e:
        app.logger.info(
            "Error reading kernel.json at path %s. Error: %s"
            % (kernel_json_template_path, e)
        )
        raise e

    environments = get_environments(project_uuid)
    for environment in environments:

        kernel_name = _config.KERNEL_NAME.format(environment_uuid=environment.uuid)

        image_name = _config.ENVIRONMENT_IMAGE_NAME.format(
            project_uuid=project_uuid, environment_uuid=environment.uuid
        )

        kernel_dir_path = os.path.join(kernels_dir_path, kernel_name)

        os.makedirs(kernel_dir_path, exist_ok=True)

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
            app.logger.info(
                "Error writing kernel.json at path %s. Error: %s"
                % (kernel_json_path, e)
            )
            raise e

    # Copy launch_kubernetes.py
    launch_kubernetes_path = os.path.join(
        app.config["RESOURCE_DIR"], "kernels", "launch_kubernetes.py"
    )
    launch_kubernetes_dest_path = os.path.join(kernels_dir_path, "launch_kubernetes.py")

    os.system('cp "%s" "%s"' % (launch_kubernetes_path, launch_kubernetes_dest_path))
