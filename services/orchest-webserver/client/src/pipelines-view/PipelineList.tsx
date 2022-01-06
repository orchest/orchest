import { IconButton } from "@/components/common/IconButton";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import SessionToggleButton from "@/components/SessionToggleButton";
import { useAppContext } from "@/contexts/AppContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
import { siteMap } from "@/Routes";
import { IOrchestSession } from "@/types";
import { checkGate } from "@/utils/webserver-utils";
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
import useSWR from "swr";
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

type PipelineMetaData = {
  name: string;
  path: string;
  uuid: string;
};

type SessionStatus = IOrchestSession["status"] | "";

type PipelineRowData = PipelineMetaData & {
  sessionStatus: SessionStatus;
};

const fetchPipelines = (uuid: string) =>
  fetcher<{ success: boolean; result: PipelineMetaData[] }>(uuid).then(
    (response) => response.result
  );

const deletePipelines = (projectUuid: string, pipelineUuid: string) => {
  return fetcher(`/async/pipelines/delete/${projectUuid}/${pipelineUuid}`, {
    method: "DELETE",
  });
};

const getColumns = (
  projectUuid: string,
  onEditPath: (uuid: string, path: string) => void
): DataTableColumn<PipelineRowData>[] => [
  {
    id: "name",
    label: "Pipeline",
    sx: { maxWidth: "30%", wordBreak: "break-word" },
  },
  {
    id: "path",
    label: "Path",
    sx: {
      maxWidth: "30%",
      wordBreak: "break-word",
    },
    render: function PipelineName(row) {
      return (
        <Stack
          direction="row"
          alignItems="center"
          component="span"
          sx={{
            display: "inline-flex",
            marginLeft: (theme) => theme.spacing(6),
            button: { visibility: "hidden" },
            "&:hover": {
              button: { visibility: "visible" },
            },
          }}
          data-test-id="pipeline-path"
        >
          {row.path}
          <IconButton
            title="Edit pipeline path"
            size="small"
            sx={{ marginLeft: (theme) => theme.spacing(2) }}
            onClick={(e: React.MouseEvent<unknown>) => {
              e.stopPropagation();
              onEditPath(row.uuid, row.path);
            }}
            data-test-id="pipeline-edit-path"
          >
            <EditIcon />
          </IconButton>
        </Stack>
      );
    },
  },
  {
    id: "sessionStatus",
    label: "Session",
    render: function SessionStatus(row) {
      return (
        <Box
          sx={{ minWidth: (theme) => theme.spacing(26), textAlign: "center" }}
        >
          <SessionToggleButton
            projectUuid={projectUuid}
            pipelineUuid={row.uuid}
            status={row.sessionStatus}
            isSwitch
          />
        </Box>
      );
    },
  },
];

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

  return (
    <TextField
      margin="normal"
      fullWidth
      autoFocus
      value={value}
      label="Pipeline path"
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
            disabled={disabled}
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
  useSessionsPoller();

  // data fetching state
  const {
    data: pipelines,
    error,
    revalidate: requestFetchPipelines,
    isValidating,
  } = useSWR<PipelineMetaData[]>(
    `/async/pipelines/${projectUuid}`,
    fetchPipelines
  );

  React.useEffect(() => {
    if (error) {
      setAlert("Error", `Failed to fetch pipelines: ${error}`);
      navigateTo(siteMap.projects.path);
    }
  }, [error, setAlert, navigateTo]);

  // Edit pipeline
  const [pipelineInEdit, setPipelineInEdit] = React.useState<{
    uuid: string;
    path: string;
  }>(null);

  const onCloseEditPipelineModal = () => {
    setPipelineInEdit(null);
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
          requestFetchPipelines();
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
    (uuid: string, path: string) => {
      setPipelineInEdit({ uuid, path });
    },
    [setPipelineInEdit]
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

  const onRowClick = async (pipelineUuid: string) => {
    const goToPipeline = (isReadOnly: boolean) => {
      navigateTo(siteMap.pipeline.path, {
        query: { projectUuid, pipelineUuid },
        state: { isReadOnly },
      });
    };
    try {
      await checkGate(projectUuid);
      goToPipeline(false);
    } catch (error) {
      goToPipeline(true);
    }
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
            requestFetchPipelines();
            resolve(true);
          })
          .catch((e) => {
            setAlert("Error", `Failed to delete pipeline: ${e}`);
            resolve(false);
          });

        return true;
      }
    );
  };

  // monitor if there's any operations ongoing, if so, disable action buttons
  const { run, status } = useAsync<void>();
  const isOperating = status === "PENDING";

  const createPipeline = React.useCallback(
    ({ name, path }: { name: string; path: string }) => {
      return run(
        fetcher(`/async/pipelines/create/${projectUuid}`, {
          method: "POST",
          headers: HEADER.JSON,
          body: JSON.stringify({ name, pipeline_path: path }),
        })
          .then(() => {
            requestFetchPipelines();
          })
          .catch((response) => {
            if (!response.isCanceled) {
              try {
                let data = JSON.parse(response.body);
                setAlert("Error", `Could not create pipeline. ${data.message}`);
              } catch {
                setAlert("Error", "Could not create pipeline. Reason unknown.");
              }
            }
          })
      );
    },
    [requestFetchPipelines, run, projectUuid, setAlert]
  );

  const isLoaded = hasValue(pipelines) && !error;

  return (
    <div className={"pipelines-view"}>
      <h2>Pipelines</h2>
      {!isLoaded ? (
        <LinearProgress />
      ) : (
        <>
          <CreatePipelineDialog
            newPipelineName={
              pipelines ? getValidNewPipelineName(pipelines) : ""
            }
            pipelineRows={pipelineRows}
            createPipeline={createPipeline}
            disabled={isOperating}
          />
          <EditProjectPathDialog
            pipelineInEdit={pipelineInEdit}
            setPipelineInEdit={setPipelineInEdit}
            isOpen={pipelineInEdit !== null}
            onSubmit={onSubmitEditPipelinePathModal}
            onClose={onCloseEditPipelineModal}
            disabled={isOperating}
          />
          <DataTable<PipelineRowData>
            id="pipeline-list"
            selectable
            hideSearch
            isLoading={isValidating}
            columns={columns}
            rows={pipelineRows}
            onRowClick={onRowClick}
            rowHeight={67}
            deleteSelectedRows={onDeletePipelines}
          />
        </>
      )}
    </div>
  );
};
