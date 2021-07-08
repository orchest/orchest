import * as React from "react";
import {
  makeRequest,
  makeCancelable,
  PromiseManager,
  RefManager,
} from "@orchest/lib-utils";
import {
  MDCIconButtonToggleReact,
  MDCButtonReact,
  MDCTextFieldReact,
  MDCLinearProgressReact,
  MDCDialogReact,
  MDCDataTableReact,
} from "@orchest/lib-mdc";
import { useOrchest } from "@/hooks/orchest";
import { checkGate } from "../utils/webserver-utils";
import SessionToggleButton from "./SessionToggleButton";
import PipelineView from "../views/PipelineView";
import ProjectsView from "@/views/ProjectsView";

const INITIAL_PIPELINE_NAME = "";
const INITIAL_PIPELINE_PATH = "pipeline.orchest";

const PipelineList: React.FC<any> = (props) => {
  const { orchest } = window;

  const context = useOrchest();

  const [state, setState] = React.useState({
    loading: true,
    createModal: false,
    createPipelineName: INITIAL_PIPELINE_NAME,
    createPipelinePath: INITIAL_PIPELINE_PATH,
    listData: null,
    pipelines: null,
  });

  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());

  const processListData = (pipelines) => {
    let listData = [];

    for (let pipeline of pipelines) {
      // @TODO Get the current Project on the Pipelines page
      listData.push([
        <span>{pipeline.name}</span>,
        <span>{pipeline.path}</span>,
        <SessionToggleButton
          project_uuid={context.state.project_uuid}
          pipeline_uuid={pipeline.uuid}
          switch={true}
          className="consume-click"
        />,
      ]);
    }

    return listData;
  };

  const fetchList = (onComplete) => {
    // initialize REST call for pipelines
    let fetchListPromise = makeCancelable(
      makeRequest("GET", `/async/pipelines/${props.project_uuid}`),
      promiseManager
    );

    fetchListPromise.promise
      .then((response) => {
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
          // @ts-ignore
          orchest.loadView(ProjectsView);
        }
      });
  };

  const openPipeline = (pipeline, readOnly) => {
    // load pipeline view
    let pipelineProps = {
      queryArgs: {
        pipeline_uuid: pipeline.uuid,
        project_uuid: props.project_uuid,
      },
    };

    if (readOnly) {
      // @ts-ignore
      pipelineProps.queryArgs.read_only = "true";
    }

    // @ts-ignore
    orchest.loadView(PipelineView, pipelineProps);
  };

  const onClickListItem = (row, idx, e) => {
    let pipeline = state.pipelines[idx];

    let checkGatePromise = checkGate(props.project_uuid);
    checkGatePromise
      .then(() => {
        openPipeline(pipeline, false);
      })
      .catch((result) => {
        openPipeline(pipeline, true);
      });
  };

  const onDeleteClick = () => {
    let selectedIndices = refManager.refs.pipelineListView.getSelectedRowIndices();

    if (selectedIndices.length === 0) {
      // @ts-ignore
      orchest.alert("Error", "You haven't selected a pipeline.");
      return;
    }

    // @ts-ignore
    orchest.confirm(
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
            `/async/pipelines/delete/${props.project_uuid}/${pipeline_uuid}`
          ).then((_) => {
            // reload list once removal succeeds
            fetchList(() => {
              setState((prevState) => ({
                ...prevState,
                loading: false,
              }));
            });
          });
        });
      }
    );
  };

  const onCreateClick = () => {
    setState((prevState) => ({
      ...prevState,
      createModal: true,
    }));
  };

  const onSubmitModal = () => {
    let pipelineName = state.createPipelineName;
    let pipelinePath = state.createPipelinePath;

    if (!pipelineName) {
      orchest.alert("Error", "Please enter a name.");
      return;
    }

    if (!pipelinePath) {
      orchest.alert("Error", "Please enter the path for the pipeline.");
      return;
    }

    if (!pipelinePath.endsWith(".orchest")) {
      orchest.alert("Error", "The path should end in the .orchest extension.");
      return;
    }

    setState((prevState) => ({
      ...prevState,
      loading: true,
    }));

    let createPipelinePromise = makeCancelable(
      makeRequest("POST", `/async/pipelines/create/${props.project_uuid}`, {
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

            orchest.alert(
              "Error",
              "Could not create pipeline. " + data.message
            );
          } catch {
            orchest.alert(
              "Error",
              "Could not create pipeline. Reason unknown."
            );
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

    setState((prevState) => ({
      ...prevState,
      createModal: false,
    }));
  };

  const onCancelModal = () => {
    refManager.refs.createPipelineDialog.close();
  };

  const onCloseCreatePipelineModal = () => {
    setState((prevState) => ({
      ...prevState,
      createModal: false,
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
      <MDCLinearProgressReact />
    </div>
  ) : (
    <div className={"pipelines-view"}>
      {state.createModal && (
        <MDCDialogReact
          title="Create a new pipeline"
          onClose={onCloseCreatePipelineModal.bind(this)}
          ref={refManager.nrefs.createPipelineDialog}
          content={
            <React.Fragment>
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
              />
              <MDCTextFieldReact
                ref={refManager.nrefs.createPipelinePathField}
                classNames={["fullwidth"]}
                label="Pipeline path"
                onChange={(value) => {
                  setState((prevState) => ({
                    ...prevState,

                    createPipelineName: value,
                  }));
                }}
                value={state.createPipelinePath}
              />
            </React.Fragment>
          }
          actions={
            <React.Fragment>
              <MDCButtonReact
                icon="close"
                label="Cancel"
                classNames={["push-right"]}
                onClick={onCancelModal.bind(this)}
              />
              <MDCButtonReact
                icon="add"
                classNames={["mdc-button--raised", "themed-secondary"]}
                label="Create pipeline"
                submitButton
                onClick={onSubmitModal.bind(this)}
              />
            </React.Fragment>
          }
        />
      )}

      <h2>Pipelines</h2>
      <div className="push-down">
        <MDCButtonReact
          classNames={["mdc-button--raised", "themed-secondary"]}
          icon="add"
          label="Create pipeline"
          onClick={onCreateClick.bind(this)}
        />
      </div>
      <div className={"pipeline-actions push-down"}>
        <MDCIconButtonToggleReact
          icon="delete"
          tooltipText="Delete pipeline"
          onClick={onDeleteClick.bind(this)}
        />
      </div>

      <MDCDataTableReact
        ref={refManager.nrefs.pipelineListView}
        selectable
        onRowClick={onClickListItem.bind(this)}
        classNames={["fullwidth"]}
        headers={["Pipeline", "Path", "Session"]}
        rows={state.listData}
      />
    </div>
  );
};

export default PipelineList;
