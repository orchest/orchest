import sys
import os
import subprocess

import nbformat
from nbconvert.preprocessors import ExecutePreprocessor
from nbconvert.preprocessors.execute import CellExecutionError
from nbconvert.filters import ansi2html

WORKING_DIR = "/notebooks"
LOG_DIR = ".logs"


class PartialExecutePreprocessor(ExecutePreprocessor):


    def __init__(self, **kw):
        self.log_file = kw['log_file']
        
        super(PartialExecutePreprocessor, self).__init__(**kw)


    def preprocess_cell(self, cell, resources, cell_index):
        """
        Executes cells without 'skip' tag only. 
        If the tag is not found cell is not executed.
        """

        tags = cell.metadata.get('tags')

        if tags is not None and 'skip' in tags:
            return cell, resources
        else:

            try:
            
                cell, resources = super().preprocess_cell(cell, resources, cell_index)

                # cell output to STDOUT of this process
                if hasattr(cell, 'outputs'):
                    for output in cell.outputs:

                        output_text = ''

                        # support multiple types of output: 
                        # output['text'] (for output['output_type']=='stream')
                        # output['data']['text/plain'] (for output['output_type']=='execute_result')
                        
                        # Note this means application/json and image/png are currently not supported for logging.
                        if 'text' in output:
                            output_text = output['text']
                        elif 'data' in output and 'text/plain' in output['data']:
                            output_text = output['data']['text/plain']

                        if not output_text.endswith('\n'):
                            output_text = ''.join([output_text, '\n'])

                        self.log_file.write("[%i] %s" % (cell['execution_count'], output_text))
                    self.log_file.flush()
                    
            except CellExecutionError as e:

                self.log_file.write("%s" % ansi2html(e))
                self.log_file.flush()

                # raise CellExecutionError to avoid execution next cells
                raise e



            # else:
            #     # TODO: Evaluate whether we want to output anything for no output cells
            #     self.log_file.write("%s" % ('<No output cell: %s >\n' % cell['cell_type']))

            return cell, resources


def inverted(dict):
    return  {v: k for k, v in dict.items()}


def clear_pipeline_step_log(step_uuid):

    log_file_path = get_log_file_path(step_uuid)

    if os.path.isfile(log_file_path):
        try:
            os.remove(log_file_path)
        except Exception as e:
            raise Exception("Failed to remove file in path %s error: %s" % (log_file_path, e))


def run_notebook(file_path, step_uuid=None):

    # TODO: extend this mapping
    kernel_mapping = {
        "orchestsoftware-scipy-notebook-augmented_docker_python": "python",
        "orchestsoftware-r-notebook-augmented_docker_ir": "ir"
    }

    nb = None
        
    with open(file_path) as f:
        nb = nbformat.read(f, as_version=4)

        # replace kernel to non-docker equivalent

        # if key not in mapping, create entry for no-effect-mapping action
        if nb.metadata.kernelspec.name not in kernel_mapping:
            kernel_mapping[nb.metadata.kernelspec.name] = nb.metadata.kernelspec.name

        nb.metadata.kernelspec.name = kernel_mapping[nb.metadata.kernelspec.name]

        # log file
        log_file_path = get_log_file_path(step_uuid)
        with open(log_file_path, 'w') as log_file:
            ep = PartialExecutePreprocessor(log_file=log_file)
            ep.preprocess(nb, {"metadata": {"path": WORKING_DIR}})

    with open(file_path, 'w', encoding='utf-8') as f:
        nb.metadata.kernelspec.name = inverted(kernel_mapping)[nb.metadata.kernelspec.name]
        nbformat.write(nb, f)


def get_log_file_path(step_uuid):
    return os.path.join(WORKING_DIR, LOG_DIR, "%s.log" % step_uuid)


def run_process(command, filename, step_uuid=None):

    log_file_path = get_log_file_path(step_uuid)

    with open(log_file_path, 'w') as f:
        process = subprocess.Popen([command, filename], cwd=WORKING_DIR, stdout=f, stderr=f)
        process.wait()

    return process.returncode
    

def create_pipeline_dir():

    log_dir_path = os.path.join(WORKING_DIR, LOG_DIR)
    if not os.path.exists(log_dir_path):
        try:
            os.makedirs(log_dir_path)
        except OSError as exc:
            raise exc


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
    file_path = os.path.join(WORKING_DIR, filename)

    # check if file exists in working directory
    if not os.path.isfile(file_path):
        raise Exception(
            "File doesn't appear to exist in file path '%s'" % (file_path,))

    # current behaviour is to always clear old logs
    clear_pipeline_step_log(step_uuid)

    # make sure log directory exists
    create_pipeline_dir()

    if file_extension == "ipynb":

        run_notebook(file_path, step_uuid=step_uuid)

    elif file_extension == "py":

        sys.exit(run_process("python3", filename, step_uuid=step_uuid))

    elif file_extension == "r":

        sys.exit(run_process("Rscript", filename, step_uuid=step_uuid))

    elif file_extension == "sh":

        sys.exit(run_process("sh", filename, step_uuid=step_uuid))

    else:
        raise Exception(
            "Running files with '%s' extension is not yet supported." % (file_extension,))


if __name__ == '__main__':
    main()
