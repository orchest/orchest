import os
import shutil


def pytest_unconfigure():
    # clean up test outputs
    test_dir = os.path.dirname(os.path.realpath(__file__))
    shutil.rmtree(os.path.join(test_dir, "test-outputs"))
