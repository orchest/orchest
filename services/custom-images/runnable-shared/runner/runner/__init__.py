import nbformat
import os
import subprocess
import uuid

from runner.preprocessors import PartialExecutePreprocessor
from runner.config import Config
from runner.utils import inverted


class Runner():

    def __init__(self, step_uuid):
        self.step_uuid = step_uuid

    def run(self):

        # current behaviour is to always clear old logs
        self.clear_pipeline_step_log()

        # make sure each log starts with a unique uuid on its first line
        self.print_unique_line()

        # make sure log directory exists
        self.create_pipeline_dir()

    def print_unique_line(self):

        log_file_path = self.get_log_file_path()
        try:
            with open(log_file_path, 'w') as file:
                file.write("%s\n" % str(uuid.uuid4()))
        except IOError as e:
            raise Exception("Could not write to log file %s" % log_file_path)

    def clear_pipeline_step_log(self):

        log_file_path = self.get_log_file_path()

        if os.path.isfile(log_file_path):
            try:
                os.remove(log_file_path)
            except Exception as e:
                raise Exception("Failed to remove file in path %s error: %s" % (log_file_path, e))

    def get_log_file_path(self):
        return os.path.join(Config.WORKING_DIR, Config.LOG_DIR, "%s.log" % self.step_uuid)

    def create_pipeline_dir(self):

        log_dir_path = os.path.join(Config.WORKING_DIR, Config.LOG_DIR)
        if not os.path.exists(log_dir_path):
            try:
                os.makedirs(log_dir_path)
            except OSError as exc:
                raise exc


class ProcessRunner(Runner):
    

    def run(self, command, filename):
        
        super().run()

        log_file_path = self.get_log_file_path()

        with open(log_file_path, 'a') as f:
            process = subprocess.Popen([command, filename], cwd=Config.WORKING_DIR, stdout=f, stderr=f)
            process.wait()

        return process.returncode


class NotebookRunner(Runner):

    def run(self, file_path):

        super().run()

        # TODO: extend this mapping
        kernel_mapping = {
            "python": "python",
            "r": "ir"
        }

        nb = None

        with open(file_path) as f:
            nb = nbformat.read(f, as_version=4)

            # set kernel based on language
            nb.metadata.kernelspec.name = kernel_mapping[nb.metadata.kernelspec.language]

            # log file
            log_file_path = self.get_log_file_path()
            with open(log_file_path, 'a') as log_file:
                ep = PartialExecutePreprocessor(log_file=log_file)
                ep.preprocess(nb, {"metadata": {"path": Config.WORKING_DIR}})

        with open(file_path, 'w', encoding='utf-8') as f:
            nb.metadata.kernelspec.name = inverted(kernel_mapping)[nb.metadata.kernelspec.name]
            nbformat.write(nb, f)


    