import React from "react";
import {
  extensionFromFilename,
  kernelNameToLanguage,
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
} from "../lib/utils/all";
import MDCSelectReact from "../lib/mdc-components/MDCSelectReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import ProjectFilePicker from "../components/ProjectFilePicker";
import { Controlled as CodeMirror } from "react-codemirror2";
require("codemirror/mode/javascript/javascript");

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

class PipelineDetailsProperties extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      kernelOptions: [
        ["python", "Python 3"],
        ["ir", "R"],
      ],
      environmentOptions: [],
      isNotebookStep:
        extensionFromFilename(this.props.step.file_path) == "ipynb",
      step: this.props.step,
      // this is required to let users edit JSON (while typing the text will not be valid JSON)
      editableParameters: JSON.stringify(this.props.step.parameters, null, 2),
    };

    this.refManager = new RefManager();
    this.promiseManager = new PromiseManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  fetchEnvironmentOptions() {
    let environmentsEndpoint = `/store/environments/${this.props.project_uuid}`;

    if (this.state.isNotebookStep) {
      environmentsEndpoint +=
        "?language=" + kernelNameToLanguage(this.state.step.kernel.name);
    }

    let fetchEnvironmentOptionsPromise = makeCancelable(
      makeRequest("GET", environmentsEndpoint),
      this.promiseManager
    );

    fetchEnvironmentOptionsPromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        let environmentOptions = [];

        for (let environment of result) {
          environmentOptions.push([environment.uuid, environment.name]);
        }

        this.setState({
          environmentOptions: environmentOptions,
        });
      })
      .catch((error) => {
        console.log(error);
      });
  }

  updateStepName() {
    this.props.onNameUpdate(
      this.props.step.uuid,
      this.state.step.title,
      this.state.step.file_path
    );
  }

  onChangeFileName(updatedFileName) {
    this.state.step.file_path = updatedFileName;

    this.setState({
      step: this.state.step,
      isNotebookStep: extensionFromFilename(updatedFileName) === "ipynb",
    });

    // block propagation for directory values
    if (!updatedFileName.endsWith("/")) {
      this.updateStepName();
      // refetch environment options as it changes depending on kernel type
      this.fetchEnvironmentOptions();
      this.props.onSave(this);
    }
  }

  onChangeVCPUS(updatedVCPUS) {
    this.state.step.vcpus = updatedVCPUS;

    this.setState({
      step: this.state.step,
    });

    this.props.onSave(this);
  }

  onChangeGPUS(updatedGPUS) {
    this.state.step.gpus = updatedGPUS;
    this.setState({
      step: this.state.step,
    });

    this.props.onSave(this);
  }

  onChangeParameterJSON(updatedParameterJSON) {
    this.setState({
      editableParameters: updatedParameterJSON,
    });

    try {
      this.state.step.parameters = JSON.parse(updatedParameterJSON);
      this.setState({
        step: this.state.step,
      });

      this.props.onSave(this);
    } catch (err) {
      // console.log("JSON did not parse")
    }
  }

  onChangeMemory(updatedMemory) {
    this.state.step.memory = updatedMemory;

    this.setState({
      step: this.state.step,
    });

    this.props.onSave(this);
  }

  onChangeEnvironment(updatedEnvironmentUUID, updatedEnvironmentName) {
    this.state.step.environment = updatedEnvironmentUUID;
    this.state.step.kernel.display_name = updatedEnvironmentName;

    this.setState({
      step: this.state.step,
    });

    this.props.onSave(this);
  }

  onChangeKernel(updatedKernel) {
    this.state.step.kernel.name = updatedKernel;

    this.setState({
      step: this.state.step,
    });

    this.props.onSave(this);

    // re-fetch environment options as it changes depending on kernel
    this.fetchEnvironmentOptions();
  }

  onChangeTitle(updatedTitle) {
    this.state.step.title = updatedTitle;

    this.setState({
      step: this.state.step,
    });

    this.updateStepName();

    this.props.onSave(this);
  }

  swapConnectionOrder(oldConnectionIndex, newConnectionIndex) {
    // check if there is work to do
    if (oldConnectionIndex != newConnectionIndex) {
      // note it's creating a reference
      let connectionList = this.state.step.incoming_connections;

      let tmp = connectionList[oldConnectionIndex];
      connectionList.splice(oldConnectionIndex, 1);
      connectionList.splice(newConnectionIndex, 0, tmp);

      this.state.step.incoming_connections = connectionList;

      this.setState({
        step: this.state.step,
      });

      this.props.onSave(this);
    }
  }

  static getDerivedStateFromProps(props) {
    return {
      step: props.step,
      isNotebookStep: extensionFromFilename(props.step.file_path) == "ipynb",
    };
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
    let connections = this.state.step.incoming_connections.map((item, key) => (
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
            value={this.state.step.title}
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
                    value={this.state.step.file_path}
                    label="File name"
                    disabled={this.props.readOnly}
                    classNames={["fullwidth", "push-down"]}
                  />
                );
              } else {
                return (
                  <ProjectFilePicker
                    cwd="/"
                    value={this.state.step.file_path}
                    project_uuid={this.props.project_uuid}
                    pipeline_uuid={this.props.pipeline_uuid}
                    onChange={this.onChangeFileName.bind(this)}
                  />
                );
              }
            })()}
          </div>

          <MDCSelectReact
            label="Kernel"
            onChange={this.onChangeKernel.bind(this)}
            options={this.state.kernelOptions}
            value={this.state.step.kernel.name}
            disabled={this.props.readOnly}
            classNames={(() => {
              let classes = ["push-down"];
              if (!this.state.isNotebookStep) {
                classes.push("hidden");
              }
              return classes;
            })()}
          />

          <MDCSelectReact
            label="Environment"
            disabled={this.props.readOnly}
            onChange={this.onChangeEnvironment.bind(this)}
            options={this.state.environmentOptions}
            value={this.state.step.environment}
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
                <div className="json-warning">
                  <i className="material-icons">warning</i> Your input is not
                  valid JSON.
                </div>
              );
            }
          })()}
        </div>

        {(() => {
          if (this.state.step.incoming_connections.length != 0) {
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
