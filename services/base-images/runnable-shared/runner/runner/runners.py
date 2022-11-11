import os
import subprocess
import uuid

import nbformat

from runner.config import Config
from runner.preprocessors import PartialExecutePreprocessor


class Runner:
    def __init__(self, pipeline_uuid, step_uuid, working_dir):
        self.pipeline_uuid = pipeline_uuid
        self.step_uuid = step_uuid
        self.working_dir = working_dir

    def run(self, file_path):

        # Current behaviour is to always clear old logs.
        self.clear_pipeline_step_log()

        # Make sure log directory exists.
        self.create_log_dir()

        # Make sure each log starts with a unique uuid on its first
        # line.
        self.print_unique_line()

        if not os.path.exists(file_path):
            self.log_file_path_not_found(file_path)
            raise ValueError(f"{file_path} not found.")
        elif not os.path.isfile(file_path):
            self.log_file_path_not_a_file(file_path)
            raise ValueError(f"{file_path} not a file.")

    def print_unique_line(self):

        log_file_path = self.get_log_file_path()
        try:
            with open(log_file_path, "w") as file:
                file.write("%s\n" % str(uuid.uuid4()))
        except IOError as e:
            raise Exception(
                "Could not write to log file %s. Error: %s [%s]"
                % (log_file_path, e, type(e))
            )

    def clear_pipeline_step_log(self):

        log_file_path = self.get_log_file_path()

        if os.path.isfile(log_file_path):
            try:
                os.remove(log_file_path)
            except Exception as e:
                raise Exception(
                    "Failed to remove file in path %s error: %s" % (log_file_path, e)
                )

    def get_log_file_path(self):
        return os.path.join(
            Config.PROJECT_DIR,
            Config.LOGS_PATH.format(pipeline_uuid=self.pipeline_uuid),
            "%s.log" % self.step_uuid,
        )

    def create_log_dir(self):

        log_dir_path = os.path.join(
            Config.PROJECT_DIR,
            Config.LOGS_PATH.format(pipeline_uuid=self.pipeline_uuid),
        )
        if not os.path.exists(log_dir_path):
            try:
                os.makedirs(log_dir_path)
            except OSError as exc:
                raise exc

    def log_file_path_not_a_file(self, file_path: str):
        log_file_path = self.get_log_file_path()
        try:
            with open(log_file_path, "a") as file:
                file.write(f'Orchest error: path "{file_path}" is not a file')
        except IOError as e:
            raise Exception(
                "Could not write to log file %s. Error: %s [%s]"
                % (log_file_path, e, type(e))
            )

    def log_file_path_not_found(self, file_path: str):
        log_file_path = self.get_log_file_path()
        try:
            with open(log_file_path, "a") as file:
                file.write(f'Orchest error: could not find file "{file_path}".')
        except IOError as e:
            raise Exception(
                "Could not write to log file %s. Error: %s [%s]"
                % (log_file_path, e, type(e))
            )


class ProcessRunner(Runner):
    def run(self, command, file_path):

        super().run(file_path)

        log_file_path = self.get_log_file_path()

        with open(log_file_path, "a") as f:
            process = subprocess.Popen(
                [command, file_path], cwd=self.working_dir, stdout=f, stderr=f
            )
            process.wait()

        return process.returncode


class NotebookRunner(Runner):

    write_after_run = True

    def run(self, file_path):

        super().run(file_path)

        # TODO: extend this mapping
        kernel_mapping = {
            "python": "python3",
            "r": "ir",
            "julia": "julia-1.7",
            "javascript": "javascript",
        }

        with open(file_path) as f:
            nb = nbformat.read(f, as_version=4)

        original_nb_kernelspec_name = nb.metadata.kernelspec.name

        # set kernel based on language
        nb.metadata.kernelspec.name = kernel_mapping[nb.metadata.kernelspec.language]

        # log file
        log_file_path = self.get_log_file_path()
        with open(log_file_path, "a") as log_file:
            ep = PartialExecutePreprocessor(
                log_file=log_file,
                nb_path=file_path,
                write_after_run=self.write_after_run,
                original_kernelspec_name=original_nb_kernelspec_name,
            )
            ep.preprocess(nb, {"metadata": {"path": self.working_dir}})

        if self.write_after_run:
            with open(file_path, "w", encoding="utf-8") as f:
                nb.metadata.kernelspec.name = original_nb_kernelspec_name
                nbformat.write(nb, f)
