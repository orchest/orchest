import { useAppContext } from "@/contexts/AppContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
import { IOrchestSession } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import { darken } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import {
  fetcher,
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import React from "react";
import { siteMap } from "../Routes";
import { checkGate } from "../utils/webserver-utils";
import { DataTable, DataTableColumn } from "./DataTable";
import SessionToggleButton from "./SessionToggleButton";

const INITIAL_PIPELINE_NAME = "Main";
const INITIAL_PIPELINE_PATH = "main.orchest";

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

const fetchPipelines = (projectUuid: string) =>
  fetcher<{ success: boolean; result: PipelineMetaData[] }>(
    `/async/pipelines/${projectUuid}`
  ).then((response) => response.result);

const requestDeletePipelines = (projectUuid: string, pipelineUuid: string) => {
  return fetcher(`/async/pipelines/delete/${projectUuid}/${pipelineUuid}`, {
    method: "DELETE",
  });
};

const getColumns = (
  projectUuid: string,
  onEditPath: (uuid: string, path: string) => void
): DataTableColumn<PipelineRowData>[] => [
  { id: "name", label: "Pipeline" },
  {
    id: "path",
    label: "Path",
    render: (row) => (
      <Tooltip title="Edit pipeline path">
        <Stack
          direction="row"
          alignItems="center"
          component="span"
          sx={{
            display: "inline-flex",
            svg: { visibility: "hidden" },
            "&:hover": {
              color: (theme) => darken(theme.palette.primary.main, 0.15),
              // textDecoration: "underline",
              svg: { visibility: "visible" },
            },
          }}
          onClick={(e: React.MouseEvent<unknown>) => {
            e.stopPropagation();
            onEditPath(row.uuid, row.path);
          }}
        >
          {row.path}
          <EditIcon
            sx={{
              width: (theme) => theme.spacing(2),
              marginLeft: (theme) => theme.spacing(1),
            }}
            color="primary"
          />
        </Stack>
      </Tooltip>
    ),
  },
  {
    id: "sessionStatus",
    label: "Session",
    render: (row) => (
      <Box sx={{ width: (theme) => theme.spacing(26) }}>
        <SessionToggleButton
          projectUuid={projectUuid}
          pipelineUuid={row.uuid}
          status={row.sessionStatus}
          isSwitch
        />
      </Box>
    ),
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

const PipelineList: React.FC<{ projectUuid: string }> = ({ projectUuid }) => {
  const { navigateTo } = useCustomRoute();
  const { setAlert, setConfirm } = useAppContext();
  const { getSession } = useSessionsContext();
  useSessionsPoller();

  const [isDeleting, setIsDeleting] = React.useState(false);

  const { run, data: pipelines, error, status } = useAsync<
    PipelineMetaData[]
  >();

  const requestFetchPipeline = () => run(fetchPipelines(projectUuid));

  React.useEffect(() => {
    requestFetchPipeline();
  }, []);

  React.useEffect(() => {
    if (status === "REJECTED" && error) {
      setAlert("Error", `Failed to fetch pipelines: ${error}`);
      navigateTo(siteMap.projects.path);
    }
  }, [status, error]);

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

  const [pipelineInEdit, setPipelineInEdit] = React.useState<{
    uuid: string;
    path: string;
  }>(null);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  const [isEditingPipelinePath, setIsEditingPipelinePath] = React.useState(
    true
  );

  const [
    isSubmittingPipelinePath,
    setIsSubmittingPipelinePath,
  ] = React.useState(false);

  const [state, setState] = React.useState({
    createPipelineName: INITIAL_PIPELINE_NAME,
    createPipelinePath: INITIAL_PIPELINE_PATH,
  });

  const [promiseManager] = React.useState(new PromiseManager());

  const openPipeline = (pipelineUuid: string, isReadOnly: boolean) => {
    navigateTo(siteMap.pipeline.path, {
      query: { projectUuid, pipelineUuid },
      state: { isReadOnly },
    });
  };

  const onRowClick = async (pipelineUuid: string) => {
    try {
      await checkGate(projectUuid);
      openPipeline(pipelineUuid, false);
    } catch (error) {
      openPipeline(pipelineUuid, true);
    }
  };

  const deletePipelines = (pipelineUuids: string[]) => {
    if (isDeleting) {
      console.error("Delete UI in progress.");
      return;
    }
    setIsDeleting(true);

    if (pipelineUuids.length === 0) {
      setAlert("Error", "You haven't selected a pipeline.");
      setIsDeleting(false);

      return;
    }

    setConfirm(
      "Warning",
      "Are you certain that you want to delete this pipeline? (This cannot be undone.)",
      async () => {
        try {
          await Promise.all(
            pipelineUuids.map((uuid) =>
              requestDeletePipelines(projectUuid, uuid)
            )
          );
          requestFetchPipeline();
        } catch (error) {
          setAlert("Error", `Failed to delete pipeline: ${error}`);
        }
        setIsDeleting(false);
      }
    );
  };

  const onCloseEditPipelineModal = () => {
    setIsEditingPipelinePath(false);
    setIsSubmittingPipelinePath(false);
  };

  const onSubmitEditPipelinePathModal = () => {
    if (!pipelineInEdit) return;
    if (!pipelineInEdit.path.endsWith(".orchest")) {
      setAlert("Error", "The path should end in the .orchest extension.");

      return;
    }

    setIsSubmittingPipelinePath(true);

    makeRequest(
      "PUT",
      `/async/pipelines/${projectUuid}/${pipelineInEdit.uuid}`,
      {
        type: "json",
        content: {
          path: pipelineInEdit.path,
        },
      }
    )
      .then((_) => {
        requestFetchPipeline();
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
      });
  };

  // const [, setCounter] = React.useState(0);
  // const forceRerender = () => setCounter((current) => current + 1);

  // console.log("HEY");
  // console.log(pathInputRef.current);

  const onEditClick = (uuid: string, path: string) => {
    setIsEditingPipelinePath(true);
    setPipelineInEdit({ uuid, path });
  };

  const onCreateClick = () => {
    setIsCreateDialogOpen(true);
  };

  const onSubmitModal = () => {
    let pipelineName = state.createPipelineName;
    let pipelinePath = state.createPipelinePath;

    if (!pipelineName) {
      setAlert("Error", "Please enter a name.");
      return;
    }

    if (!pipelinePath) {
      setAlert("Error", "Please enter the path for the pipeline.");
      return;
    }

    if (!pipelinePath.endsWith(".orchest")) {
      setAlert("Error", "The path should end in the .orchest extension.");
      return;
    }

    let createPipelinePromise = makeCancelable(
      makeRequest("POST", `/async/pipelines/create/${projectUuid}`, {
        type: "json",
        content: {
          name: pipelineName,
          pipeline_path: pipelinePath,
        },
      }),
      promiseManager
    );

    createPipelinePromise.promise
      .then((_) => {
        requestFetchPipeline();
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
      .finally(() => {
        // reload list once creation succeeds
        setState((prevState) => ({
          ...prevState,
          createPipelineName: INITIAL_PIPELINE_NAME,
          createPipelinePath: INITIAL_PIPELINE_PATH,
        }));
      });

    setIsCreateDialogOpen(false);
  };

  const onCloseCreatePipelineModal = () => {
    setIsCreateDialogOpen(false);
    setState((prevState) => ({
      ...prevState,
      createPipelineName: INITIAL_PIPELINE_NAME,
      createPipelinePath: INITIAL_PIPELINE_PATH,
    }));
  };

  const columns = React.useMemo(() => getColumns(projectUuid, onEditClick), [
    projectUuid,
  ]);

  return !["RESOLVED", "REJECTED"].includes(status) ? (
    <div className={"pipelines-view"}>
      <h2>Pipelines</h2>
      <LinearProgress />
    </div>
  ) : (
    <div className={"pipelines-view"}>
      <Dialog open={isCreateDialogOpen} onClose={onCloseCreatePipelineModal}>
        <DialogTitle>Create a new pipeline</DialogTitle>
        <DialogContent>
          <TextField
            margin="normal"
            fullWidth
            value={state.createPipelineName}
            label="Pipeline name"
            onChange={(e) => {
              const value = e.target.value;
              setState((prevState) => ({
                ...prevState,
                createPipelinePath:
                  value.toLowerCase().replace(/[\W]/g, "_") + ".orchest",
                createPipelineName: value,
              }));
            }}
            data-test-id="pipeline-name-textfield"
          />
          <TextField
            margin="normal"
            fullWidth
            label="Pipeline path"
            onChange={(e) => {
              const value = e.target.value;
              setState((prevState) => ({
                ...prevState,
                createPipelinePath: value,
              }));
            }}
            value={state.createPipelinePath}
            data-test-id="pipeline-path-textfield"
          />
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<CloseIcon />}
            color="secondary"
            onClick={onCloseCreatePipelineModal}
          >
            Cancel
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            type="submit"
            onClick={onSubmitModal}
            data-test-id="pipeline-create-ok"
          >
            Create pipeline
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={isEditingPipelinePath && pipelineInEdit !== null}
        onClose={onCloseEditPipelineModal}
      >
        <DialogTitle>Edit pipeline path</DialogTitle>
        <DialogContent>
          <PipelinePathTextField
            value={pipelineInEdit?.path}
            onChange={(newPath) => {
              setPipelineInEdit((current) => ({ ...current, path: newPath }));
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<CloseIcon />}
            color="secondary"
            onClick={onCloseEditPipelineModal}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={isSubmittingPipelinePath}
            type="submit"
            onClick={onSubmitEditPipelinePathModal}
            data-test-id="pipeline-edit-path-save"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <h2>Pipelines</h2>
      <div className="push-down">
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreateClick}
          data-test-id="pipeline-create"
        >
          Create pipeline
        </Button>
      </div>

      <DataTable<PipelineRowData>
        id="pipeline-list"
        selectable
        hideSearch
        columns={columns}
        rows={pipelineRows}
        onRowClick={onRowClick}
        deleteSelectedRows={deletePipelines}
      />
    </div>
  );
};

export default PipelineList;
