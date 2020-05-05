import sys
import os
import subprocess

import nbformat
from nbconvert.preprocessors import ExecutePreprocessor

WORKING_DIR = "/notebooks"


class PartialExecutePreprocessor(ExecutePreprocessor):

    def preprocess_cell(self, cell, resources, cell_index):
        """
        Executes cells without 'skip' tag only. 
        If the tag is not found cell is not executed.
        """

        tags = cell.metadata.get('tags')

        if tags is not None and 'skip' in tags:
            return cell, resources
        else:
            return super().preprocess_cell(cell, resources, cell_index)


def inverted(dict):
    return  {v: k for k, v in dict.items()}


def main():

    # index 1 contains filename
    if len(sys.argv) < 2:
        raise Exception(
            "Should pass in the filename that you want to execute.")

    filename = sys.argv[1]

    file_extension = filename.split(".")[-1]

    # TODO: extend this mapping
    kernel_mapping = {
        "scipy-notebook_docker_python": "python",
        "scipy-notebook_docker_r": "r"
    }

    file_path = os.path.join(WORKING_DIR, filename)

    # check if file exists in working directory
    if not os.path.isfile(file_path):
        raise Exception(
            "File doesn't appear to exist in file path '%s'" % (file_path,))

    process = None

    if file_extension == "ipynb":

        nb = None
        

        with open(file_path) as f:
            nb = nbformat.read(f, as_version=4)

            # replace kernel to non-docker equivalent
            nb.metadata.kernelspec.name = kernel_mapping[nb.metadata.kernelspec.name]

            ep = PartialExecutePreprocessor()

            ep.preprocess(nb, {"metadata": {"path": WORKING_DIR}})

        with open(file_path, 'w', encoding='utf-8') as f:
            nb.metadata.kernelspec.name = inverted(kernel_mapping)[nb.metadata.kernelspec.name]
            nbformat.write(nb, f)

    elif file_extension == "py":
        process = subprocess.Popen(["python3", filename], cwd=WORKING_DIR, stderr=subprocess.STDOUT)
    elif file_extension == "sh":
        process = subprocess.Popen(["sh", filename], cwd=WORKING_DIR, stderr=subprocess.STDOUT)
    else:
        raise Exception(
            "Running files with '%s' extension is not yet supported." % (file_extension,))

    if process:
        process.wait()
        sys.exit(process.returncode)
        

if __name__ == '__main__':
    main()
