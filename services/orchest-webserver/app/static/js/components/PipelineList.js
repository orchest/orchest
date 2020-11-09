import React, { Fragment } from "react";

import PipelineView from "../views/PipelineView";
import MDCIconButtonToggleReact from "../lib/mdc-components/MDCIconButtonToggleReact";
import {
  makeRequest,
  makeCancelable,
  PromiseManager,
  RefManager,
} from "../lib/utils/all";
import {
  checkGate
} from "../utils/webserver-utils";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import MDCDialogReact from "../lib/mdc-components/MDCDialogReact";
import MDCDataTableReact from "../lib/mdc-components/MDCDataTableReact";
import SessionToggleButton from "./SessionToggleButton";

class PipelineList extends React.Component {
  componentWillUnmount() {}

  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      createModal: false,
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidMount() {
    this.fetchList(() => {
      this.setState({
        loading: false,
      });
    });

    // set headerbar
    orchest.headerBarComponent.clearPipeline();
  }

  processListData(pipelines) {
    let listData = [];

    for (let pipeline of pipelines) {
      listData.push([
        <span>{pipeline.name}</span>,
        <span>{pipeline.path}</span>,
        <SessionToggleButton
          classNames={["consume-click"]}
          pipeline_uuid={pipeline.uuid}
          project_uuid={this.props.project_uuid}
        />,
      ]);
    }

    return listData;
  }

  fetchList(onComplete) {
    // initialize REST call for pipelines
    let fetchListPromise = makeCancelable(
      makeRequest("GET", `/async/pipelines/${this.props.project_uuid}`),
      this.promiseManager
    );

    fetchListPromise.promise.then((response) => {
      let data = JSON.parse(response);
      this.setState({
        listData: this.processListData(data.result),
        pipelines: data.result,
      });

      if (this.refManager.refs.pipelineListView) {
        this.refManager.refs.pipelineListView.setSelectedRowIds([]);
      }

      onComplete();
    });
  }

  openPipeline(pipeline, readOnly){

    // load pipeline view
    let props = {
      pipeline_uuid: pipeline.uuid,
      project_uuid: this.props.project_uuid,
      pipeline_path: pipeline.path,
    };

    if(readOnly){
      props.readOnly = true;
    }

    orchest.loadView(PipelineView, props);
  }

  onClickListItem(row, idx, e) {

    let pipeline = this.state.pipelines[idx];
    let readOnly = false;

    if (e.ctrlKey || e.metaKey) {
      readOnly = true;
    }

    let checkGatePromise = checkGate();
    checkGatePromise.then(() => {
      this.openPipeline(pipeline, readOnly);
    }).catch((result) => {
      this.openPipeline(pipeline, true);
    })
    
  }

  onDeleteClick() {
    let selectedIndices = this.refManager.refs.pipelineListView.getSelectedRowIndices();

    if (selectedIndices.length === 0) {
      orchest.alert("Error", "You haven't selected a pipeline.");
      return;
    }

    orchest.confirm(
      "Warning",
      "Are you certain that you want to delete this pipeline? (This cannot be undone.)",
      () => {
        this.setState({
          loading: true,
        });

        selectedIndices.forEach((index) => {
          let pipeline_uuid = this.state.pipelines[index].uuid;

          makeRequest(
            "GET",
            `/api-proxy/api/sessions/?project_uuid=${this.props.project_uuid}&pipeline_uuid=${pipeline_uuid}`
          ).then((response) => {
            let data = JSON.parse(response);
            if (data["sessions"].length > 0) {
              makeRequest(
                "DELETE",
                `/api-proxy/api/sessions/${this.props.project_uuid}/${pipeline_uuid}`
              );
            }
          });

          makeRequest(
            "DELETE",
            `/async/pipelines/delete/${this.props.project_uuid}/${pipeline_uuid}`
          ).then((_) => {
            // reload list once removal succeeds
            this.fetchList(() => {
              this.setState({
                loading: false,
              });
            });
          });
        });
      }
    );
  }

  onCreateClick() {
    this.setState({
      createModal: true,
    });

    this.refManager.refs.createPipelineNameTextField.focus();
  }

  componentDidUpdate(prevProps, prevState, snapshot) {}

  onSubmitModal() {
    let pipelineName = this.refManager.refs.createPipelineNameTextField.mdc
      .value;
    let pipelinePath = this.refManager.refs.createPipelinePathField.mdc.value;

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

    this.setState({
      loading: true,
    });

    makeRequest("POST", `/async/pipelines/create/${this.props.project_uuid}`, {
      type: "json",
      content: {
        name: pipelineName,
        pipeline_path: pipelinePath,
      },
    })
      .then((_) => {
        // reload list once creation succeeds
        this.fetchList(() => {
          this.setState({
            loading: false,
          });
        });
      })
      .catch((response) => {
        try {
          let data = JSON.parse(response.body);
          orchest.alert("Could not create pipeline. " + data.message);
        } catch {
          orchest.alert("Could not create pipeline. Reason unknown.");
        }

        this.setState({
          loading: false,
        });
      });

    this.setState({
      createModal: false,
    });
  }

  onCancelModal() {
    this.setState({
      createModal: false,
    });
  }

  render() {
    if (!this.state.loading) {
      return (
        <div className={"pipelines-view"}>
          {(() => {
            if (this.state.createModal) {
              return (
                <MDCDialogReact
                  title="Create a new pipeline"
                  content={
                    <Fragment>
                      <MDCTextFieldReact
                        ref={this.refManager.nrefs.createPipelineNameTextField}
                        classNames={["fullwidth push-down"]}
                        label="Pipeline name"
                      />
                      <MDCTextFieldReact
                        ref={this.refManager.nrefs.createPipelinePathField}
                        classNames={["fullwidth"]}
                        label="Pipeline path"
                        value="pipeline.orchest"
                      />
                    </Fragment>
                  }
                  actions={
                    <Fragment>
                      <MDCButtonReact
                        icon="device_hub"
                        classNames={["mdc-button--raised", "themed-secondary"]}
                        label="Create pipeline"
                        onClick={this.onSubmitModal.bind(this)}
                      />
                      <MDCButtonReact
                        icon="close"
                        label="Cancel"
                        classNames={["push-left"]}
                        onClick={this.onCancelModal.bind(this)}
                      />
                    </Fragment>
                  }
                />
              );
            }
          })()}

          <h2>Pipelines</h2>
          <div className={"pipeline-actions push-down"}>
            <MDCIconButtonToggleReact
              icon="add"
              onClick={this.onCreateClick.bind(this)}
            />
            <MDCIconButtonToggleReact
              icon="delete"
              onClick={this.onDeleteClick.bind(this)}
            />
          </div>

          <MDCDataTableReact
            ref={this.refManager.nrefs.pipelineListView}
            selectable
            onRowClick={this.onClickListItem.bind(this)}
            classNames={["fullwidth"]}
            headers={["Pipeline", "Path", "Session"]}
            rows={this.state.listData}
          />
        </div>
      );
    } else {
      return (
        <div className={"pipelines-view"}>
          <h2>Pipelines</h2>
          <MDCLinearProgressReact />
        </div>
      );
    }
  }
}

export default PipelineList;
