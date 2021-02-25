import React from "react";
import {
  extensionFromFilename,
  kernelNameToLanguage,
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
  relativeToAbsolutePath,
} from "../lib/utils/all";

import _ from "lodash";
import MDCSelectReact from "../lib/mdc-components/MDCSelectReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import ProjectFilePicker from "../components/ProjectFilePicker";
import { Controlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/javascript/javascript";

class ConnectionItem extends React.Component {
  componentDidMount() {}

  render() {
    return (
      <div className="connection-item" data-uuid={this.props.connection.uuid}>
        <i className="material-icons">drag_indicator</i>{" "}
        <span>{this.props.connection.name[0]}</span>{" "}
        <span className="filename">({this.props.connection.name[1]})</span>
      </div>
    );
  }
}

const KERNEL_OPTIONS = [
  ["python", "Python"],
  ["r", "R"],
  ["julia", "Julia"],
];

class PipelineDetailsProperties extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      environmentOptions: [],
      // this is required to let users edit JSON (while typing the text will not be valid JSON)
      editableParameters: JSON.stringify(this.props.step.parameters, null, 2),
    };

    this.refManager = new RefManager();
    this.promiseManager = new PromiseManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
    $(document).off("mouseup.connectionList");
    $(document).off("mousemove.connectionList");
  }

  isNotebookStep() {
    return extensionFromFilename(this.props.step.file_path) == "ipynb";
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.step.kernel.name != this.props.step.kernel.name ||
      prevProps.step.file_path != this.props.step.file_path
    ) {
      this.fetchEnvironmentOptions();
    }
  }

  fetchEnvironmentOptions() {
    let environmentsEndpoint = `/store/environments/${this.props.project_uuid}`;

    if (this.isNotebookStep()) {
      environmentsEndpoint +=
        "?language=" + kernelNameToLanguage(this.props.step.kernel.name);
    }

    let fetchEnvironmentOptionsPromise = makeCancelable(
      makeRequest("GET", environmentsEndpoint),
      this.promiseManager
    );

    fetchEnvironmentOptionsPromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        let environmentOptions = [];

        let currentEnvironmentInEnvironments = false;

        for (let environment of result) {
          if (environment.uuid == this.props.step.environment) {
            currentEnvironmentInEnvironments = true;
          }
          environmentOptions.push([environment.uuid, environment.name]);
        }

        if (!currentEnvironmentInEnvironments) {
          // update environment
          this.onChangeEnvironment(
            environmentOptions.length > 0 ? environmentOptions[0][0] : "",
            environmentOptions.length > 0 ? environmentOptions[0][1] : ""
          );
        }

        this.setState({
          environmentOptions: environmentOptions,
        });
      })
      .catch((error) => {
        console.log(error);
      });
  }

  updateStepName(step_uuid, title, file_path) {
    this.props.onNameUpdate(step_uuid, title, file_path);
  }

  onChangeFileName(updatedFileName) {
    let step = _.cloneDeep(this.props.step);
    step.file_path = updatedFileName;

    this.updateStepName(step.uuid, step.title, step.file_path);
    this.props.onSave(step);
  }

  onChangeVCPUS(updatedVCPUS) {
    let step = _.cloneDeep(this.props.step);
    step.vcpus = updatedVCPUS;
    this.props.onSave(step);
  }

  onChangeGPUS(updatedGPUS) {
    let step = _.cloneDeep(this.props.step);
    step.gpus = updatedGPUS;
    this.props.onSave(step);
  }

  onChangeParameterJSON(updatedParameterJSON) {
    this.setState({
      editableParameters: updatedParameterJSON,
    });

    try {
      let step = _.cloneDeep(this.props.step);
      step.parameters = JSON.parse(updatedParameterJSON);
      this.props.onSave(step);
    } catch (err) {
      // console.log("JSON did not parse")
    }
  }

  onChangeMemory(updatedMemory) {
    let step = _.cloneDeep(this.props.step);
    step.memory = updatedMemory;
    this.props.onSave(step);
  }

  onChangeEnvironment(updatedEnvironmentUUID, updatedEnvironmentName) {
    let step = _.cloneDeep(this.props.step);

    step.environment = updatedEnvironmentUUID;
    step.kernel.display_name = updatedEnvironmentName;

    this.props.onSave(step);
    if (updatedEnvironmentUUID !== "" && step["file_path"] !== "") {
      let kernelName = `orchest-kernel-${updatedEnvironmentUUID}`;
      orchest.jupyter.setNotebookKernel(
        relativeToAbsolutePath(step["file_path"], this.props.pipelineCwd).slice(
          1
        ),
        kernelName
      );
    }
  }

  onChangeKernel(updatedKernel) {
    let step = _.cloneDeep(this.props.step);
    step.kernel.name = updatedKernel;
    this.props.onSave(step);
  }

  onChangeTitle(updatedTitle) {
    let step = _.cloneDeep(this.props.step);
    step.title = updatedTitle;

    this.updateStepName(step.uuid, step.title, step.file_path);

    this.props.onSave(step);
  }

  swapConnectionOrder(oldConnectionIndex, newConnectionIndex) {
    // check if there is work to do
    if (oldConnectionIndex != newConnectionIndex) {
      let step = _.cloneDeep(this.props.step);

      // note it's creating a reference
      let connectionList = step.incoming_connections;

      let tmp = connectionList[oldConnectionIndex];
      connectionList.splice(oldConnectionIndex, 1);
      connectionList.splice(newConnectionIndex, 0, tmp);

      step.incoming_connections = connectionList;

      this.props.onSave(step);
    }
  }

  setupConnectionListener() {
    // initiate draggable connections
    let _this = this;

    let previousPosition = 0;
    let connectionItemOffset = 0;
    let oldConnectionIndex = 0;
    let newConnectionIndex = 0;
    let numConnectionListItems = $(_this.refManager.refs.connectionList).find(
      ".connection-item"
    ).length;

    $(this.refManager.refs.connectionList).on(
      "mousedown",
      ".connection-item",
      function (e) {
        previousPosition = e.clientY;
        connectionItemOffset = 0;

        $(_this.refManager.refs.connectionList).addClass("dragging");

        oldConnectionIndex = $(this).index();

        $(this).addClass("selected");

        console.log(
          "[Assert] Should trigger once, otherwise listener duplication going on."
        );
      }
    );

    $(document).on("mousemove.connectionList", function (e) {
      let selectedConnection = $(_this.refManager.refs.connectionList).find(
        ".connection-item.selected"
      );

      if (selectedConnection.length > 0) {
        let positionDelta = e.clientY - previousPosition;
        let itemHeight = selectedConnection.outerHeight();

        connectionItemOffset += positionDelta;

        // limit connectionItemOffset
        if (connectionItemOffset < -itemHeight * oldConnectionIndex) {
          connectionItemOffset = -itemHeight * oldConnectionIndex;
        } else if (
          connectionItemOffset >
          itemHeight * (numConnectionListItems - oldConnectionIndex - 1)
        ) {
          connectionItemOffset =
            itemHeight * (numConnectionListItems - oldConnectionIndex - 1);
        }

        selectedConnection.css({
          transform: "translateY(" + connectionItemOffset + "px)",
        });

        previousPosition = e.clientY;

        // find new index based on current position
        let elementYPosition =
          (oldConnectionIndex * itemHeight + connectionItemOffset) / itemHeight;

        newConnectionIndex = Math.min(
          Math.max(0, Math.round(elementYPosition)),
          numConnectionListItems - 1
        );

        // evaluate swap classes for all elements in list besides selectedConnection
        for (let i = 0; i < numConnectionListItems; i++) {
          if (i != oldConnectionIndex) {
            let connectionListItem = $(_this.refManager.refs.connectionList)
              .find(".connection-item")
              .eq(i);

            connectionListItem.removeClass("swapped-up");
            connectionListItem.removeClass("swapped-down");

            if (newConnectionIndex >= i && i > oldConnectionIndex) {
              connectionListItem.addClass("swapped-up");
            } else if (newConnectionIndex <= i && i < oldConnectionIndex) {
              connectionListItem.addClass("swapped-down");
            }
          }
        }
      }
    });

    // Note, listener should be unmounted
    $(document).on("mouseup.connectionList", function (e) {
      let selectedConnection = $(_this.refManager.refs.connectionList).find(
        ".connection-item.selected"
      );

      if (selectedConnection.length > 0) {
        selectedConnection.css({ transform: "" });
        selectedConnection.removeClass("selected");

        $(_this.refManager.refs.connectionList)
          .find(".connection-item")
          .removeClass("swapped-up")
          .removeClass("swapped-down");

        $(_this.refManager.refs.connectionList).removeClass("dragging");

        _this.swapConnectionOrder(oldConnectionIndex, newConnectionIndex);
      }
    });
  }

  componentDidMount() {
    if (!this.props.readOnly) {
      // set focus on first field
      this.refManager.refs.titleTextField.focus();
      this.setupConnectionListener();
    }

    this.fetchEnvironmentOptions();
  }

  render() {
    let connections = this.props.step.incoming_connections.map((item, key) => (
      <ConnectionItem
        connection={{
          name: this.props.connections[item],
          uuid: item,
        }}
        key={key}
      />
    ));

    return (
      <div className={"detail-subview"}>
        <div className="input-group">
          <MDCTextFieldReact
            value={this.props.step.title}
            onChange={this.onChangeTitle.bind(this)}
            label="Title"
            disabled={this.props.readOnly}
            classNames={["fullwidth", "push-down"]}
            ref={this.refManager.nrefs.titleTextField}
          />

          <div className="push-down">
            {(() => {
              if (this.props.readOnly) {
                return (
                  <MDCTextFieldReact
                    value={this.props.step.file_path}
                    label="File name"
                    disabled={this.props.readOnly}
                    classNames={["fullwidth", "push-down"]}
                  />
                );
              } else {
                return (
                  <ProjectFilePicker
                    cwd="/"
                    value={this.props.step.file_path}
                    project_uuid={this.props.project_uuid}
                    pipeline_uuid={this.props.pipeline_uuid}
                    step_uuid={this.props.step.uuid}
                    onChange={this.onChangeFileName.bind(this)}
                  />
                );
              }
            })()}
          </div>

          <MDCSelectReact
            label="Kernel language"
            onChange={this.onChangeKernel.bind(this)}
            options={KERNEL_OPTIONS}
            value={this.props.step.kernel.name}
            disabled={this.props.readOnly}
            classNames={(() => {
              let classes = ["push-down", "fullwidth"];
              if (!this.isNotebookStep()) {
                classes.push("hidden");
              }
              return classes;
            })()}
          />

          <MDCSelectReact
            label="Environment"
            disabled={this.props.readOnly}
            classNames={["fullwidth"]}
            onChange={this.onChangeEnvironment.bind(this)}
            options={this.state.environmentOptions}
            value={this.props.step.environment}
          />
        </div>

        <div className="input-group">
          <h3>Parameters</h3>

          <CodeMirror
            value={this.state.editableParameters}
            options={{
              mode: "application/json",
              theme: "jupyter",
              lineNumbers: true,
              readOnly: this.props.readOnly === true, // not sure whether CodeMirror accepts 'falsy' values
            }}
            onBeforeChange={(editor, data, value) => {
              this.onChangeParameterJSON(value);
            }}
          />

          {(() => {
            try {
              JSON.parse(this.state.editableParameters);
            } catch {
              return (
                <div className="warning push-up push-down">
                  <i className="material-icons">warning</i> Your input is not
                  valid JSON.
                </div>
              );
            }
          })()}
        </div>

        {(() => {
          if (this.props.step.incoming_connections.length != 0) {
            return (
              <div className="input-group">
                <h3>Connections</h3>

                <div
                  className="connection-list"
                  ref={this.refManager.nrefs.connectionList}
                >
                  {connections}
                </div>
              </div>
            );
          }
        })()}
      </div>
    );
  }
}

export default PipelineDetailsProperties;
