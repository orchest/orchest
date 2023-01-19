import { useGlobalContext } from "@/contexts/GlobalContext";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useProjectPipelines } from "@/hooks/useProjectPipelines";
import { siteMap } from "@/routingConfig";
import type { PipelineMetaData } from "@/types";
import { toValidFilename } from "@/utils/toValidFilename";
import { checkGate } from "@/utils/webserver-utils";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";

export const INITIAL_PIPELINE_NAME = "Main";
export const INITIAL_PIPELINE_PATH = "main.orchest";

const getPathFromName = (name: string) => `${toValidFilename(name)}.orchest`;
const regExp = new RegExp(`^${INITIAL_PIPELINE_NAME}( [0-9]+)?`, "i");

const getValidNewPipelineName = (
  pipelines: Pick<PipelineMetaData, "name">[]
) => {
  const largestExistingNumber = pipelines.reduce((existingNumber, pipeline) => {
    const matches = pipeline.name?.match(regExp);
    if (!matches) return existingNumber;
    // if the name is "Main", matches[1] will be undefined, we count it as 0
    // if the name is "Main 123", matches[1] will be " 123", trim it and parse it as Integer
    const currentNumber = !matches[1] ? 0 : parseInt(matches[1].trim());
    return Math.max(existingNumber, currentNumber);
  }, -1);
  const newNumber = largestExistingNumber + 1;
  return newNumber > 0
    ? `${INITIAL_PIPELINE_NAME} ${newNumber}`
    : INITIAL_PIPELINE_NAME;
};

export const CreatePipelineDialog = ({
  children,
}: {
  children: (onCreateClick: () => void) => React.ReactNode;
}) => {
  const { setAlert } = useGlobalContext();
  const { projectUuid, navigateTo } = useCustomRoute();
  const { run, status } = useAsync<{ pipeline_uuid: string }>();
  const pipelines = useProjectPipelines(projectUuid);

  const [isOpen, setIsOpen] = React.useState(false);
  const onCreateClick = () => setIsOpen(true);
  const onClose = React.useCallback(() => {
    if (status !== "PENDING") setIsOpen(false);
  }, [status]);

  const navigateToPipeline = React.useCallback(
    async (pipelineUuid: string) => {
      if (!projectUuid) return;

      const goToPipeline = (isReadOnly: boolean) => {
        navigateTo(siteMap.pipeline.path, {
          query: { projectUuid, pipelineUuid: pipelineUuid },
          state: { isReadOnly },
        });
      };
      try {
        await checkGate(projectUuid);
        goToPipeline(false);
      } catch (error) {
        goToPipeline(true);
      }
    },
    [navigateTo, projectUuid]
  );
  const createPipeline = React.useCallback(
    async ({ name, path }: { name: string; path: string }) => {
      if (!projectUuid) return;

      try {
        const response = await run(
          fetcher<{ pipeline_uuid: string }>(
            `/async/pipelines/create/${projectUuid}`,
            {
              method: "POST",
              headers: HEADER.JSON,
              body: JSON.stringify({ name, pipeline_path: path }),
            }
          )
        );
        const { pipeline_uuid } = response || {};
        if (!pipeline_uuid) return;
        onClose();
        navigateToPipeline(pipeline_uuid);
      } catch (error) {
        onClose();
        setAlert(
          "Error",
          `Could not create pipeline. ${error.message || "Reason unknown."}`
        );
      }
    },
    [run, projectUuid, setAlert, navigateToPipeline, onClose]
  );

  const [newPipeline, setNewPipeline] = React.useState({
    name: INITIAL_PIPELINE_NAME,
    path: INITIAL_PIPELINE_PATH,
  });

  React.useEffect(() => {
    // create a valid name if name is taken
    const newPipelineName = getValidNewPipelineName(pipelines ?? []);
    if (newPipelineName && isOpen) {
      setNewPipeline({
        name: newPipelineName,
        path: getPathFromName(newPipelineName),
      });
    }
  }, [pipelines, isOpen]);

  const isPathTaken = pipelines?.some((row) => row.path === newPipeline.path);

  const pathValidation = isPathTaken
    ? "File already exists"
    : !newPipeline.path.endsWith(".orchest")
    ? "The path should end in the .orchest extension."
    : newPipeline.path === ".orchest"
    ? "a file name is required"
    : "";

  const isFormValid = newPipeline.name.length > 0 && !pathValidation;

  const onSubmit = () => {
    if (!isFormValid) return;

    setIsOpen(false);
    createPipeline(newPipeline);
  };

  return (
    <>
      {children(onCreateClick)}
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
              required
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
              required
              label="Pipeline path"
              onChange={(e) => {
                const path = e.target.value;
                setNewPipeline((prev) => ({ ...prev, path }));
              }}
              value={newPipeline.path}
              error={pathValidation.length > 0}
              helperText={pathValidation || " "}
              data-test-id="pipeline-path-textfield"
            />
          </DialogContent>
          <DialogActions>
            <Button startIcon={<CloseIcon />} onClick={onClose} tabIndex={-1}>
              Cancel
            </Button>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              type="submit"
              form="create-pipeline"
              disabled={!isFormValid || status === "PENDING"}
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
