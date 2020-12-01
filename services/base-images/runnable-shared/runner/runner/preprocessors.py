import typing as t

from nbformat.v4 import output_from_msg
from nbconvert.preprocessors import ExecutePreprocessor
from nbconvert.preprocessors.execute import CellExecutionError
from nbconvert.filters import ansi2html


class PartialExecutePreprocessor(ExecutePreprocessor):
    def __init__(self, log_file, **kw):
        self.log_file = log_file

        self.printed_indices = set()

        # TODO: don't share cell as global state
        self.current_cell = None

        super(PartialExecutePreprocessor, self).__init__(**kw)

        # disable timeout
        self.timeout = None

    def log_output_message(self, output):

        if self.current_cell is None:
            raise Exception(
                "log_output_message should not be called if there is no current notebook cell"
            )

        # cell output to STDOUT of this process
        output_text = ""

        # support multiple types of output:
        # output['text'] (for output['output_type']=='stream')
        # output['data']['text/plain'] (for output['output_type']=='execute_result')

        # Note this means application/json and image/png are currently not supported for logging.
        if "text" in output:
            output_text = output["text"]
        elif "data" in output and "text/plain" in output["data"]:
            output_text = output["data"]["text/plain"]

        if not output_text.endswith("\n"):
            output_text = "".join([output_text, "\n"])

        # process output text with ansi2html to prep for output
        # in html log viewer
        output_text = ansi2html(output_text)

        prefix = "[%i] " % self.current_cell["execution_count"]
        if self.current_cell["execution_count"] in self.printed_indices:
            prefix = ""
        else:
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

    def preprocess_cell(self, cell, resources, cell_index):
        """
        Executes cells without 'skip' tag only.
        If the tag is not found cell is not executed.
        """

        tags = cell.metadata.get("tags")

        if tags is not None and "skip" in tags:
            return cell, resources
        else:

            try:

                self.current_cell = cell

                cell, resources = super().preprocess_cell(cell, resources, cell_index)

                # TODO: Evaluate whether we want to output anything for no output cells
                # self.log_file.write("%s" % ('<No output cell: %s >\n' % cell['cell_type']))

                return cell, resources

            except CellExecutionError as e:

                self.log_file.write("%s" % e)
                self.log_file.flush()

                # raise CellExecutionError to avoid execution next cells
                raise e
