import os
import shutil

from runner.runners import NotebookRunner
from runner.config import Config


def test_cell_output_format():

    Config.WORKING_DIR = os.path.join(
        os.path.dirname(os.path.realpath(__file__)), "test-outputs"
    )

    nr = NotebookRunner("")

    # don't write to notebook file in test
    nr.write_after_run = False

    nr.run("tests/test-files/loop.ipynb")

    # check log file
    with open("tests/test-outputs/.orchest/logs/.log", "r") as f:
        contents = f.read()

        # skip first line as it is a random uuid
        contents = "\n".join(contents.split("\n")[1:])

        assert contents.strip() == "[1] 0\n1\n2\n3\n4"

    # clean up test outputs
    shutil.rmtree("tests/test-outputs/")
