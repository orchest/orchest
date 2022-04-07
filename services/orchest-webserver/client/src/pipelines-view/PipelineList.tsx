import { IconButton } from "@/components/common/IconButton";
import { PageTitle } from "@/components/common/PageTitle";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import SessionToggleButton from "@/components/SessionToggleButton";
import { useAppContext } from "@/contexts/AppContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchPipelines } from "@/hooks/useFetchPipelines";
import { siteMap } from "@/Routes";
import type { PipelineMetaData } from "@/types";
import { IOrchestSession } from "@/types";
import { ellipsis } from "@/utils/styles";
import { checkGate } from "@/utils/webserver-utils";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import React from "react";
import { INITIAL_PIPELINE_NAME } from "./common";
import { CreatePipelineDialog } from "./CreatePipelineDialog";

const regExp = new RegExp(`^${INITIAL_PIPELINE_NAME}( [0-9]+)?`, "i");

const getValidNewPipelineName = (pipelines: PipelineMetaData[]) => {
  const largestExistingNumber = pipelines.reduce((existingNumber, pipeline) => {
    const matches = pipeline.name.match(regExp);
    if (!matches) return existingNumber;
    // if the name is "Main", matches[1] will be undefined, we count it as 0
    // if the name is "Main", matches[1] will be " 123", trim it and parse it as Integer
    const currentNumber = !matches[1] ? 0 : parseInt(matches[1].trim());
    return Math.max(existingNumber, currentNumber);
  }, -1);
  const newNumber = largestExistingNumber + 1;
  return newNumber > 0
    ? `${INITIAL_PIPELINE_NAME} ${newNumber}`
    : INITIAL_PIPELINE_NAME;
};

const getErrorMessages = (path: string) => ({
  0: "",
  1: "Cannot change the pipeline path if an interactive session is running. Please stop it first.",
  2: `Cannot change the pipeline path, a file path with the name ${path}" already exists.`,
  3: "The pipeline does not exist.",
  4: 'The pipeline file name should end with ".orchest".',
  5: "The pipeline file does not exist.",
  6: "Can't move the pipeline outside of the project.",
});

type SessionStatus = IOrchestSession["status"] | "";

type PipelineRowData = PipelineMetaData & {
  sessionStatus: SessionStatus;
};

const deletePipelines = (projectUuid: string, pipelineUuid: string) => {
  return fetcher(`/async/pipelines/delete/${projectUuid}/${pipelineUuid}`, {
    method: "DELETE",
  });
};

const getColumns = (
  projectUuid: string,
  onEditPath: (uuid: string, path: string, sessionStatus: SessionStatus) => void
): DataTableColumn<PipelineRowData>[] => [
  {
    id: "name",
    label: "Pipeline",
    sx: ellipsis("30vw"),
  },
  {
    id: "path",
    label: "Path",
    align: "left",
    sx: { margin: (theme) => theme.spacing(-0.5, 0) },
    render: function PipelineName(row) {
      return (
        <Stack
          direction="row"
          alignItems="center"
          component="span"
          sx={{
            display: "inline-flex",
            button: { visibility: "hidden" },
            "&:hover": {
              button: { visibility: "visible" },
            },
          }}
          data-test-id="pipeline-path"
        >
          <Box component="span" sx={ellipsis("30vw")}>
            {row.path}
          </Box>
          <IconButton
            title="Edit pipeline path"
            size="small"
            sx={{ marginLeft: (theme) => theme.spacing(2) }}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
              onEditPath(row.uuid, row.path, row.sessionStatus);
            }}
            onAuxClick={(e) => {
              // middle click on this button shouldn't open new tab
              e.stopPropagation();
              e.preventDefault();
            }}
            data-test-id="pipeline-edit-path"
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Stack>
      );
    },
  },
  {
    id: "sessionStatus",
    label: "Session",
    align: "left",
    sx: {
      margin: (theme) => theme.spacing(-0.5, 0),
      paddingLeft: (theme) => theme.spacing(2),
      minWidth: (theme) => theme.spacing(26),
    },
    render: function SessionStatus(row) {
      return (
        <SessionToggleButton
          projectUuid={projectUuid}
          pipelineUuid={row.uuid}
          status={row.sessionStatus}
          isSwitch
        />
      );
    },
  },
];

const isValidPath = (value: string) => (value || "").endsWith(".orchest");

const PipelinePathTextField: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const pathInputRef = React.useRef<HTMLInputElement>();
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (pathInputRef.current && value && !initializedRef.current) {
      initializedRef.current = true;
      pathInputRef.current.focus();
      pathInputRef.current.setSelectionRange(
        value.indexOf(".orchest"),
        value.indexOf(".orchest")
      );
    }
  }, [value]);

  const isValid = isValidPath(value);

  return (
    <TextField
      margin="normal"
      fullWidth
      multiline
      autoFocus
      value={value}
      label="Pipeline path"
      error={!isValid}
      helperText={!isValid ? "path should end in the .orchest extension" : " "}
      inputRef={pathInputRef}
      onChange={(e) => {
        const value = e.target.value;
        onChange(value);
      }}
      data-test-id="pipeline-edit-path-textfield"
    />
  );
};

const EditProjectPathDialog = ({
  pipelineInEdit,
  setPipelineInEdit,
  onSubmit,
  isOpen,
  onClose,
  disabled,
}: {
  pipelineInEdit: {
    uuid: string;
    path: string;
  };
  setPipelineInEdit: React.Dispatch<
    React.SetStateAction<{
      uuid: string;
      path: string;
    }>
  >;
  isOpen: boolean;
  onSubmit: () => void;
  onClose: () => void;
  disabled: boolean;
}) => {
  const isValid = isValidPath(pipelineInEdit?.path || "");
  return (
    <Dialog fullWidth maxWidth="xs" open={isOpen} onClose={onClose}>
      <form
        id="edit-pipeline-path"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSubmit();
        }}
      >
        <DialogTitle>Edit pipeline path</DialogTitle>
        <DialogContent>
          <PipelinePathTextField
            value={pipelineInEdit?.path}
            onChange={(newPath) => {
              setPipelineInEdit((current) => ({
                ...current,
                path: newPath,
              }));
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button startIcon={<CloseIcon />} color="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={!isValid || disabled}
            type="submit"
            form="edit-pipeline-path"
            data-test-id="pipeline-edit-path-save"
          >
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export const PipelineList: React.FC<{ projectUuid: string }> = ({
  projectUuid,
}) => {
  // global states
  const { navigateTo } = useCustomRoute();
  const { setAlert, setConfirm } = useAppContext();
  const { getSession } = useSessionsContext();

  // data fetching state
  const {
    pipelines,
    setPipelines,
    error,
    fetchPipelines,
    isFetchingPipelines,
  } = useFetchPipelines(projectUuid);

  React.useEffect(() => {
    if (error) {
      setAlert("Error", `Failed to fetch pipelines: ${error}`);
      navigateTo(siteMap.projects.path);
    }
  }, [error, setAlert, navigateTo]);

  // monitor if there's any operations ongoing, if so, disable action buttons
  const { run, status } = useAsync<void>();

  // Edit pipeline
  const [pipelineInEdit, setPipelineInEdit] = React.useState<{
    uuid: string;
    path: string;
  }>(null);
  const [isEditingPath, setIsEditingPath] = React.useState(false);

  const onCloseEditPipelineModal = () => {
    setIsEditingPath(false);
  };

  const onSubmitEditPipelinePathModal = () => {
    if (!pipelineInEdit) return;
    if (!pipelineInEdit.path.endsWith(".orchest")) {
      setAlert("Error", "The path should end in the .orchest extension.");
      return;
    }

    run(
      fetcher(`/async/pipelines/${projectUuid}/${pipelineInEdit.uuid}`, {
        method: "PUT",
        headers: HEADER.JSON,
        body: JSON.stringify({
          path: pipelineInEdit.path,
        }),
      })
        .then(() => {
          setPipelines((currentPipelines) => {
            return currentPipelines.map((currentPipeline) =>
              currentPipeline.uuid === pipelineInEdit.uuid
                ? { ...currentPipeline, path: pipelineInEdit.path }
                : currentPipeline
            );
          });
        })
        .catch((e) => {
          try {
            let resp = JSON.parse(e.body);

            setAlert("Error", getErrorMessages(pipelineInEdit.path)[resp.code]);
          } catch (error) {
            console.error(error);
          }
        })
        .finally(() => {
          onCloseEditPipelineModal();
        })
    );
  };

  // Preparing Pipelines DataTable
  const onEditClick = React.useCallback(
    (uuid: string, path: string, sessionStatus: SessionStatus) => {
      if (!["", "STOPPING"].includes(sessionStatus)) {
        setAlert(
          "Warning",
          "In order to change a pipeline path, you need to stop its session."
        );
        return;
      }
      setPipelineInEdit({ uuid, path });
      setIsEditingPath(true);
    },
    [setPipelineInEdit, setAlert]
  );
  const columns = React.useMemo(() => {
    return getColumns(projectUuid, onEditClick);
  }, [projectUuid, onEditClick]);
  const pipelineRows = React.useMemo(() => {
    return (pipelines || []).map((pipeline) => {
      return {
        ...pipeline,
        sessionStatus: (getSession({
          pipelineUuid: pipeline.uuid,
          projectUuid,
        })?.status || "") as SessionStatus,
      };
    });
  }, [pipelines, projectUuid, getSession]);

  const navigateToPipeline = React.useCallback(
    async (pipelineUuid: string, e?: React.MouseEvent) => {
      const goToPipeline = (isReadOnly: boolean) => {
        navigateTo(
          siteMap.pipeline.path,
          {
            query: { projectUuid, pipelineUuid },
            state: { isReadOnly },
          },
          e
        );
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

  const onRowClick = async (e: React.MouseEvent, pipelineUuid: string) => {
    return navigateToPipeline(pipelineUuid, e);
  };

  const onDeletePipelines = async (pipelineUuids: string[]) => {
    return setConfirm(
      "Warning",
      "Are you certain that you want to delete this pipeline? (This cannot be undone.)",
      async (resolve) => {
        Promise.all(
          pipelineUuids.map((pipelineUuid) =>
            deletePipelines(projectUuid, pipelineUuid)
          )
        )
          .then(() => {
            resolve(true);
          })
          .catch((e) => {
            setAlert("Error", `Failed to delete pipeline: ${e}`);
            resolve(false);
          })
          .finally(() => {
            fetchPipelines();
          });

        return true;
      }
    );
  };

  const isOperating = status === "PENDING";

  const createPipeline = React.useCallback(
    ({ name, path }: { name: string; path: string }) => {
      return run(
        fetcher<{ pipeline_uuid: string }>(
          `/async/pipelines/create/${projectUuid}`,
          {
            method: "POST",
            headers: HEADER.JSON,
            body: JSON.stringify({ name, pipeline_path: path }),
          }
        )
          .then(({ pipeline_uuid }) => navigateToPipeline(pipeline_uuid))
          .catch((error) => {
            setAlert(
              "Error",
              `Could not create pipeline. ${error.message || "Reason unknown."}`
            );
          })
      );
    },
    [run, projectUuid, setAlert, navigateToPipeline]
  );

  const isLoaded = hasValue(pipelines) && !error;

  return (
    <div className={"pipelines-view"}>
      <PageTitle>Pipelines</PageTitle>
      {!isLoaded ? (
        <LinearProgress />
      ) : (
        <>
          <CreatePipelineDialog pipelines={pipelines} disabled={isOperating}>
            {(onCreateClick) => (
              <Box sx={{ margin: (theme) => theme.spacing(2, 0) }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={onCreateClick}
                  data-test-id="pipeline-create"
                >
                  Create pipeline
                </Button>
              </Box>
            )}
          </CreatePipelineDialog>
          <EditProjectPathDialog
            pipelineInEdit={pipelineInEdit}
            setPipelineInEdit={setPipelineInEdit}
            isOpen={isEditingPath}
            onSubmit={onSubmitEditPipelinePathModal}
            onClose={onCloseEditPipelineModal}
            disabled={isOperating}
          />
          <DataTable<PipelineRowData>
            id="pipeline-list"
            selectable
            hideSearch
            isLoading={isFetchingPipelines}
            columns={columns}
            rows={pipelineRows}
            onRowClick={onRowClick}
            deleteSelectedRows={onDeletePipelines}
          />
        </>
      )}
    </div>
  );
};
