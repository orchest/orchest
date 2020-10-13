import os

import shutil
from runner import NotebookRunner
from runner import Config

# TODO: Make this into a real test suite.

def main():
    
    Config.WORKING_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "test-outputs")

    nr = NotebookRunner("")
    nr.run("test-files/Untitled.ipynb")

    # check log file
    with open("test-outputs/.orchest/logs/.log", 'r') as f:
        contents = f.read()

        if contents.strip() != "[1] 0\n1\n2\n3\n4":
            raise("Test failed. Log output not as expected.")
        else:
            print("Test succeeded.")

    # clean up test
    shutil.rmtree("test-outputs/")
    

if __name__ == "__main__":
    main()