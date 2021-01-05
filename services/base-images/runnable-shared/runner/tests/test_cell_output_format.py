import os
import shutil

import pytest

from runner.config import Config
from runner.runners import NotebookRunner

Config.PROJECT_DIR = os.path.join(
    os.path.dirname(os.path.realpath(__file__)), "test-outputs"
)


def test_cell_output_format():

    nr = NotebookRunner("pipeline_uuid", "step_uuid", Config.PROJECT_DIR)

    # don't write to notebook file in test
    nr.write_after_run = False

    nr.run(os.path.join(Config.PROJECT_DIR, "../test-files/loop.ipynb"))

    # check log file
    with open(
        os.path.join(
            Config.PROJECT_DIR, ".orchest/pipelines/pipeline_uuid/logs/step_uuid.log"
        ),
        "r",
    ) as f:
        contents = f.read()

        # skip first line as it is a random uuid
        contents = "\n".join(contents.split("\n")[1:])

        assert contents.strip() == "[1] 0\n1\n2\n3\n4"
