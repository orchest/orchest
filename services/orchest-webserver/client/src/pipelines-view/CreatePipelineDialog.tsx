import { useAppContext } from "@/contexts/AppContext";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import React from "react";
import { INITIAL_PIPELINE_NAME, INITIAL_PIPELINE_PATH } from "./common";

const getPathFromName = (name: string) =>
  `${name.toLowerCase().replace(/[\W]/g, "_")}.orchest`;

export const CreatePipelineDialog = ({
  pipelineRows,
  newPipelineName,
  createPipeline,
  disabled,
}: {
  pipelineRows: { path: string }[];
  newPipelineName: string;
  createPipeline: (newPipeline: {
    name: string;
    path: string;
  }) => Promise<void>;
  disabled: boolean;
}) => {
  const { setAlert } = useAppContext();

  const [isOpen, setIsOpen] = React.useState(false);
  const [newPipeline, setNewPipeline] = React.useState({
    name: INITIAL_PIPELINE_NAME,
    path: INITIAL_PIPELINE_PATH,
  });

  React.useEffect(() => {
    // create a valid name if name is taken
    if (newPipelineName && isOpen) {
      setNewPipeline({
        name: newPipelineName,
        path: getPathFromName(newPipelineName),
      });
    }
  }, [newPipelineName, isOpen]);

  const onCreateClick = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  const isPathTaken = pipelineRows.some((row) => row.path === newPipeline.path);

  const onSubmit = async () => {
    if (!newPipeline.name) {
      setAlert("Error", "Please enter a name.");
      return;
    }

    if (!newPipeline.path || newPipeline.path === ".orchest") {
      setAlert("Error", "Please enter the path for the pipeline.");
      return;
    }

    if (!newPipeline.path.endsWith(".orchest")) {
      setAlert("Error", "The path should end in the .orchest extension.");
      return;
    }

    createPipeline(newPipeline);

    setIsOpen(false);
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={onCreateClick}
        data-test-id="pipeline-create"
        sx={{ margin: (theme) => theme.spacing(2, 0) }}
      >
        Create pipeline
      </Button>
      <Dialog fullWidth maxWidth="xs" open={isOpen} onClose={onClose}>
        <form
          id="create-pipeline"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSubmit();
          }}
        >
          <DialogTitle>Create a new pipeline</DialogTitle>
          <DialogContent>
            <TextField
              margin="normal"
              fullWidth
              autoFocus
              value={newPipeline.name}
              label="Pipeline name"
              onChange={(e) => {
                const name = e.target.value;
                setNewPipeline({ name, path: getPathFromName(name) });
              }}
              data-test-id="pipeline-name-textfield"
            />
            <TextField
              margin="normal"
              fullWidth
              label="Pipeline path"
              onChange={(e) => {
                const path = e.target.value;
                setNewPipeline((prev) => ({ ...prev, path }));
              }}
              value={newPipeline.path}
              error={isPathTaken}
              helperText={isPathTaken ? "File already exists" : ""}
              data-test-id="pipeline-path-textfield"
            />
          </DialogContent>
          <DialogActions>
            <Button
              startIcon={<CloseIcon />}
              color="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              type="submit"
              form="create-pipeline"
              disabled={isPathTaken || disabled}
              data-test-id="pipeline-create-ok"
            >
              Create pipeline
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
};
