import sys
import os
import subprocess
import nbformat

from runner import NotebookRunner, ProcessRunner
from runner.config import Config

def main():

    if "STEP_UUID" not in os.environ:
        raise Exception("No STEP_UUID passed as environment variable.")

    # index 1 contains filename
    if len(sys.argv) < 2:
        raise Exception(
            "Should pass in the filename that you want to execute.")

    step_uuid = os.environ.get("STEP_UUID")

    filename = sys.argv[1]
    file_extension = filename.split(".")[-1].lower()
    file_path = os.path.join(Config.WORKING_DIR, filename)

    # check if file exists in working directory
    if not os.path.isfile(file_path):
        raise Exception(
            "File doesn't appear to exist in file path '%s'" % (file_path,))

    if file_extension == "ipynb":

        nr = NotebookRunner(step_uuid)
        nr.run(file_path)

    elif file_extension in ["py", "r", "sh"]:

        extension_script_mapping = {
            "py": "python3",
            "r": "Rscript",
            "sh": "sh"
        }

        pr = ProcessRunner(step_uuid)
        sys.exit(pr.run(extension_script_mapping[file_extension], filename))

    else:
        raise Exception(
            "Running files with '%s' extension is not yet supported." % (file_extension,))


if __name__ == '__main__':
    main()
