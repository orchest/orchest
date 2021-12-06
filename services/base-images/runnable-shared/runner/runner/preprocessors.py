import logging
import typing as t

import nbformat
from nbconvert.preprocessors import ExecutePreprocessor
from nbconvert.preprocessors.execute import CellExecutionError
from nbformat.v4 import output_from_msg

logger = logging.getLogger(__name__)


class PartialExecutePreprocessor(ExecutePreprocessor):
    """This class extends the ExecutePreprocesser from nbconvert in
    order catch the output of cell execution and write it to the
    appropriate logs consumed by Orchest.

    It's called Partial because it skips over cells in its execution
    process that have been tagged 'skip'. A useful feature for running
    Notebooks that contain code left over from interactive
    sessions.
    """

    # Configuration option of `nbclient.client.NotebookClient` to skip
    # cells with a given tag, which we subclass through
    # `ExecutePreprocessor`.
    skip_cells_with_tag = "skip"

    def __init__(
        self, log_file, nb_path, write_after_run, original_kernelspec_name, **kw
    ):
        self.log_file = log_file
        self.nb_path = nb_path
        self.write_after_run = write_after_run
        self.original_kernelspec_name = original_kernelspec_name

        self.printed_indices = set()

        # TODO: don't share cell as global state
        self.current_cell = None

        super(PartialExecutePreprocessor, self).__init__(**kw)

        # disable timeout
        self.timeout = None

    def log_output_message(self, output):

        if self.current_cell is None:
            raise Exception(
                "log_output_message should not be called if there is no current"
                " notebook cell"
            )

        # cell output to STDOUT of this process
        output_text = ""

        # support multiple types of output:
        # (for output['output_type']=='stream')
        # output['text']
        # (for output['output_type']=='execute_result')
        # output['data']['text/plain']

        # Note this means application/json and image/png are currently
        # not supported for logging.
        if "text" in output:
            output_text = output["text"]
        elif "data" in output and "text/plain" in output["data"]:
            output_text = output["data"]["text/plain"]

        prefix = "[%i] " % self.current_cell["execution_count"]
        if self.current_cell["execution_count"] in self.printed_indices:
            prefix = ""
        else:
            # Add newline prefix (except for first cell)
            # We add a prefix newline, since we then don't have to
            # determine when a cell has printed its last output.
            if len(self.printed_indices) > 0:
                prefix = "\n" + prefix

            self.printed_indices.add(self.current_cell["execution_count"])

        self.log_file.write("".join([prefix, output_text]))
        self.log_file.flush()

    def output(
        self, outs: t.List, msg: t.Dict, display_id: str, cell_index: int
    ) -> t.Optional[t.List]:

        msg_type = msg["msg_type"]

        try:
            out = output_from_msg(msg)
            self.log_output_message(out)

        except ValueError:
            self.log.error("unhandled iopub msg: " + msg_type)
            return None

        return super().output(outs, msg, display_id, cell_index)

    def preprocess(self, nb, resources=None, km=None):
        self.nb_ref = nb
        super().preprocess(nb, resources, km)

    def preprocess_cell(self, cell, resources, cell_index):
        """
        Executes cells without "skip" tag only.
        """

        # write the notebook before each preprocess action
        if self.write_after_run:
            with open(self.nb_path, "w", encoding="utf-8") as f:
                tmp_name = self.nb_ref.metadata.kernelspec.name
                self.nb_ref.metadata.kernelspec.name = self.original_kernelspec_name
                nbformat.write(self.nb_ref, f)
                self.nb_ref.metadata.kernelspec.name = tmp_name

        try:

            self.current_cell = cell

            cell, resources = super().preprocess_cell(cell, resources, cell_index)

            # TODO: Evaluate whether we want to output anything for
            # no output cells
            # self.log_file.write(
            # "%s" % ('<No output cell: %s >\n' % cell['cell_type'])
            # )

            return cell, resources

        except CellExecutionError as e:

            logger.error(f"Cell failed to execute with kernel: {self.kernel_name}")
            self.log_file.write("%s" % e)
            self.log_file.flush()

            # raise CellExecutionError to avoid execution next cells
            raise e
