import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import {
  MDCDataTableReact,
  MDCIconButtonToggleReact,
  MDCTextFieldReact,
} from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
} from "@orchest/lib-utils";
import React from "react";
import { siteMap } from "../Routes";
import { checkGate } from "../utils/webserver-utils";
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

const PipelineList: React.FC<{ projectUuid: string }> = ({ projectUuid }) => {
  const { navigateTo } = useCustomRoute();
  const { setAlert, setConfirm } = useAppContext();
  useSessionsPoller();

  const [pipelineInEdit, setPipelineInEdit] = React.useState<{
    uuid: string;
    path: string;
  }>(null);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  const [isEditingPipelinePath, setIsEditingPipelinePath] = React.useState(
    false
  );

  const [
    isSubmittingPipelinePath,
    setIsSubmittingPipelinePath,
  ] = React.useState(false);

  const [state, setState] = React.useState({
    loading: true,
    isDeleting: false,
    createPipelineName: INITIAL_PIPELINE_NAME,
    createPipelinePath: INITIAL_PIPELINE_PATH,
    // editPipelinePath: undefined,
    // editPipelinePathUUID: undefined,
    listData: null,
    pipelines: null,
  });

  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());

  const processListData = (pipelines) => {
    let listData = pipelines.map((pipeline) => [
      <span
        key={`pipeline-${pipeline.name}`}
        data-test-id={`pipeline-${pipeline.name}`}
      >
        {pipeline.name}
      </span>,
      <span key="pipeline-edit-path" className="mdc-icon-table-wrapper">
        {pipeline.path}{" "}
        <span className="consume-click">
          <MDCIconButtonToggleReact
            icon="edit"
            onClick={() => {
              onEditClick(pipeline.uuid, pipeline.path);
            }}
            data-test-id="pipeline-edit-path"
          />
        </span>
      </span>,
      <SessionToggleButton
        key={pipeline.uuid}
        projectUuid={projectUuid}
        pipelineUuid={pipeline.uuid}
        switch={true}
        className="consume-click"
      />,
    ]);

    return listData;
  };

  const fetchList = (onComplete) => {
    // initialize REST call for pipelines
    let fetchListPromise = makeCancelable(
      makeRequest("GET", `/async/pipelines/${projectUuid}`),
      promiseManager
    );

    fetchListPromise.promise
      .then((response: string) => {
        let data = JSON.parse(response);
        setState((prevState) => ({
          ...prevState,
          listData: processListData(data.result),
          pipelines: data.result,
        }));

        if (refManager.refs.pipelineListView) {
          refManager.refs.pipelineListView.setSelectedRowIds([]);
        }

        onComplete();
      })
      .catch((e) => {
        if (e && e.status == 404) {
          navigateTo(siteMap.projects.path);
        }
      });
  };

  const openPipeline = (pipeline, isReadOnly: boolean) => {
    navigateTo(siteMap.pipeline.path, {
      query: {
        projectUuid,
        pipelineUuid: pipeline.uuid,
      },
      state: { isReadOnly },
    });
  };

  const onClickListItem = (row, idx, e) => {
    let pipeline = state.pipelines[idx];

    let checkGatePromise = checkGate(projectUuid);
    checkGatePromise
      .then(() => {
        openPipeline(pipeline, false);
      })
      .catch(() => {
        openPipeline(pipeline, true);
      });
  };

  const onDeleteClick = () => {
    if (!state.isDeleting) {
      setState((prevState) => ({
        ...prevState,
        isDeleting: true,
      }));

      let selectedIndices = refManager.refs.pipelineListView.getSelectedRowIndices();

      if (selectedIndices.length === 0) {
        setAlert("Error", "You haven't selected a pipeline.");

        setState((prevState) => ({
          ...prevState,
          isDeleting: false,
        }));

        return;
      }

      setConfirm(
        "Warning",
        "Are you certain that you want to delete this pipeline? (This cannot be undone.)",
        () => {
          setState((prevState) => ({
            ...prevState,
            loading: true,
          }));

          selectedIndices.forEach((index) => {
            let pipeline_uuid = state.pipelines[index].uuid;

            // deleting the pipeline will also take care of running
            // sessions, runs, jobs
            makeRequest(
              "DELETE",
              `/async/pipelines/delete/${projectUuid}/${pipeline_uuid}`
            )
              .then((_) => {
                // reload list once removal succeeds
                fetchList(() => {
                  setState((prevState) => ({
                    ...prevState,
                    loading: false,
                    isDeleting: false,
                  }));
                });
              })
              .catch(() => {
                setState((prevState) => ({
                  ...prevState,
                  loading: false,
                  isDeleting: false,
                }));
              });
          });
        },
        () => {
          setState((prevState) => ({
            ...prevState,
            isDeleting: false,
          }));
        }
      );
    } else {
      console.error("Delete UI in progress.");
    }
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
        fetchList(() => {
          setState((prevState) => ({
            ...prevState,
            loading: false,
          }));
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
      });
  };

  const onEditClick = (uuid: string, path: string) => {
    setIsEditingPipelinePath(true);
    setPipelineInEdit({
      uuid,
      path,
    });
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

    setState((prevState) => ({
      ...prevState,
      loading: true,
    }));

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
        fetchList(() => {
          setState((prevState) => ({
            ...prevState,
            loading: false,
          }));
        });
      })
      .catch((response) => {
        if (!response.isCanceled) {
          try {
            let data = JSON.parse(response.body);

            setAlert("Error", `Could not create pipeline. ${data.message}`);
          } catch {
            setAlert("Error", "Could not create pipeline. Reason unknown.");
          }

          setState((prevState) => ({
            ...prevState,
            loading: false,
          }));
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

  React.useEffect(() => {
    fetchList(() => {
      setState((prevState) => ({
        ...prevState,
        loading: false,
      }));
    });

    return () => promiseManager.cancelCancelablePromises();
  }, []);

  return state.loading ? (
    <div className={"pipelines-view"}>
      <h2>Pipelines</h2>
      <LinearProgress />
    </div>
  ) : (
    <div className={"pipelines-view"}>
      <Dialog open={isCreateDialogOpen} onClose={onCloseCreatePipelineModal}>
        <DialogTitle>Create a new pipeline</DialogTitle>
        <DialogContent>
          <>
            <MDCTextFieldReact
              classNames={["fullwidth push-down"]}
              value={state.createPipelineName}
              label="Pipeline name"
              onChange={(value) => {
                setState((prevState) => ({
                  ...prevState,
                  createPipelinePath:
                    value.toLowerCase().replace(/[\W]/g, "_") + ".orchest",
                  createPipelineName: value,
                }));
              }}
              data-test-id="pipeline-name-textfield"
            />
            <MDCTextFieldReact
              ref={refManager.nrefs.createPipelinePathField}
              classNames={["fullwidth"]}
              label="Pipeline path"
              onChange={(value) => {
                setState((prevState) => ({
                  ...prevState,
                  createPipelinePath: value,
                }));
              }}
              value={state.createPipelinePath}
              data-test-id="pipeline-path-textfield"
            />
          </>
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
          <MDCTextFieldReact
            classNames={["fullwidth push-down"]}
            value={pipelineInEdit?.path}
            label="Pipeline path"
            initialCursorPosition={pipelineInEdit?.path.indexOf(".orchest")}
            onChange={(value) => {
              setState((prevState) => ({
                ...prevState,
                editPipelinePath: value,
              }));
            }}
            data-test-id="pipeline-edit-path-textfield"
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
      <div className={"pipeline-actions push-down"}>
        <MDCIconButtonToggleReact
          icon="delete"
          tooltipText="Delete pipeline"
          disabled={state.isDeleting}
          onClick={onDeleteClick}
          data-test-id="pipeline-delete"
        />
      </div>

      <MDCDataTableReact
        ref={refManager.nrefs.pipelineListView}
        selectable
        onRowClick={onClickListItem}
        classNames={["fullwidth"]}
        headers={["Pipeline", "Path", "Session"]}
        rows={state.listData}
        data-test-id="pipelines-table"
      />
    </div>
  );
};

export default PipelineList;
