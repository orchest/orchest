import os
import logging

from app.utils import get_synthesized_images


def populate_kernels(app, db):

    # check whether all kernels are available in the userdir/.orchest/kernels

    # use database to figure out which kernel directories should exist

    # kernel directory naming scheme: 
    # 
    # orchestsoftware/custom-base-kernel-py:abc
    # --> 
    # orchestsoftware-custom-base-kernel-py:abc

    synthesized_images, image_languages = get_synthesized_images()

    # TODO: consider not removing full directory

    kernels_dir_path = os.path.join(app.config['USER_DIR'], ".orchest", "kernels")

    # remove all kernels
    if not os.path.exists(kernels_dir_path):
        os.makedirs(kernels_dir_path)
    else:
        os.system("rm -rf %s/*" % kernels_dir_path)

    # kernel.json template
    kernel_json_template_path = os.path.join(app.config['RESOURCE_DIR'], "kernels", "docker", "kernel.json")
    
    try:
        with open(kernel_json_template_path, 'r') as f:
            kernel_json_template = f.read()
    except Exception as e:
        logging.info("Error reading kernel.json at path %s. Error: %s" % (kernel_json_template_path, e))
        raise e

    # create kernel_dirs
    for index, image in enumerate(synthesized_images):

        kernel_dir_name = image.replace("/", "-")

        kernel_dir_path = os.path.join(kernels_dir_path, kernel_dir_name)

        os.makedirs(kernel_dir_path)

        # write filled template kernel.json
        filled_kernel_json = kernel_json_template.replace("{image_name}", image) \
            .replace("{language}", image_languages[index])
        
        kernel_json_path = os.path.join(kernel_dir_path, "kernel.json")
        
        try:
            with open(kernel_json_path, 'w') as f:
                f.write(filled_kernel_json)
        except Exception as e:
            logging.info("Error writing kernel.json at path %s. Error: %s" % (kernel_json_path, e))
            raise e

    # copy launch_docker.py
    launch_docker_path = kernel_json_template_path = os.path.join(app.config['RESOURCE_DIR'], "kernels", "launch_docker.py")
    launch_docker_dest_path = kernel_json_template_path = os.path.join(kernels_dir_path, "launch_docker.py")
    
    os.system("cp %s %s" % (launch_docker_path, launch_docker_dest_path))


