import React from "react";
import {
  MDCButtonReact,
  MDCDialogReact,
  MDCLinearProgressReact,
} from "@orchest/lib-mdc";
import { RefManager, makeRequest } from "@orchest/lib-utils";
import { checkGate } from "../utils/webserver-utils";
import EnvironmentsView from "../views/EnvironmentsView";

class BuildPendingDialog extends React.Component {
  constructor(props) {
    super(props);

    let messageSuffix = "";
    switch (props.requestedFromView) {
      case "Pipeline":
        messageSuffix =
          " You can cancel to open the pipeline in read-only mode.";
        break;
      case "JupyterLab":
        messageSuffix =
          " To start JupyterLab all environments in the project need to be built.";
        break;
    }

    let environmentsToBeBuilt = [];
    let buildHasFailed = false;
    for (let x = 0; x < props.environmentValidationData.actions.length; x++) {
      if (props.environmentValidationData.actions[x] == "BUILD") {
        environmentsToBeBuilt.push(props.environmentValidationData.fail[x]);
      } else if (props.environmentValidationData.actions[x] == "FAILURE") {
        buildHasFailed = true;
      }
    }

    let message = "";
    if (buildHasFailed) {
      message = `Some environment builds of this project have failed.`;
    } else if (environmentsToBeBuilt.length > 0) {
      message =
        `Not all environments of this project have been built. Would you like to build them?` +
        messageSuffix;
    } else {
      message =
        `Some environments of this project are still building. Please wait until the build is complete.` +
        messageSuffix;
    }

    this.state = {
      building: environmentsToBeBuilt.length == 0,
      buildHasFailed: buildHasFailed,
      environmentsToBeBuilt: environmentsToBeBuilt,
      message: message,
      showBuildStatus: environmentsToBeBuilt.length == 0,
      allowBuild: environmentsToBeBuilt.length > 0,
    };

    this.refManager = new RefManager();
  }

  close() {
    this.refManager.refs.dialogRef.close();
  }

  componentWillUnmount() {
    clearInterval(this.gateInterval);
  }

  startPollingGate() {
    clearInterval(this.gateInterval);
    this.gateInterval = setInterval(this.gateCheckWrapper.bind(this), 1000);
  }

  gateCheckWrapper() {
    checkGate(this.props.project_uuid)
      .then(() => {
        this.setState({
          building: false,
        });

        if (this.props.onBuildComplete) {
          this.props.onBuildComplete();
          this.close();
        }
      })
      .catch((error) => {
        // gate check failed, check why it failed and act
        // accordingly

        // Environment failed to build.
        if (error.data.actions.includes("FAILURE")) {
          const message = "One of the environment builds has failed.";
          this.setState({
            buildHasFailed: true,
            message: message,
          });
          clearInterval(this.gateInterval);
        }
      });
  }

  componentDidMount() {
    if (this.state.buildHasFailed) {
    } else if (this.state.environmentsToBeBuilt.length == 0) {
      this.startPollingGate();
    }
  }

  onBuild() {
    this.setState({
      allowBuild: false,
      showBuildStatus: true,
      building: true,
    });

    let environment_build_requests = [];
    for (let environmentUUID of this.state.environmentsToBeBuilt) {
      environment_build_requests.push({
        environment_uuid: environmentUUID,
        project_uuid: this.props.project_uuid,
      });
    }

    makeRequest("POST", "/catch/api-proxy/api/environment-builds", {
      type: "json",
      content: {
        environment_build_requests: environment_build_requests,
      },
    })
      .then(() => {
        this.startPollingGate();
      })
      .catch((error) => {
        console.error("Failed to start environment builds:", error);
      });
  }

  onViewBuildStatus() {
    orchest.setProject(this.props.project_uuid);
    orchest.loadView(EnvironmentsView);
    this.close();
  }

  onCancel() {
    if (this.props.onCancel) {
      this.props.onCancel();
    }
    this.close();
  }

  render() {
    return (
      <MDCDialogReact
        ref={this.refManager.nrefs.dialogRef}
        title={"Build"}
        onClose={this.props.onClose}
        content={
          <div>
            <p className="push-down">{this.state.message}</p>
            {this.state.building && <MDCLinearProgressReact />}
          </div>
        }
        actions={
          <>
            <MDCButtonReact label="Cancel" onClick={this.onCancel.bind(this)} />
            {this.state.showBuildStatus && (
              <MDCButtonReact
                submitButton
                label="View build status"
                classNames={
                  !this.state.allowBuild
                    ? ["push-left", "mdc-button--raised", "themed-secondary"]
                    : ["push-left"]
                }
                onClick={this.onViewBuildStatus.bind(this)}
              />
            )}
            {this.state.allowBuild && (
              <MDCButtonReact
                submitButton
                classNames={[
                  "mdc-button--raised",
                  "themed-secondary",
                  "push-left",
                ]}
                label="Build"
                onClick={this.onBuild.bind(this)}
              />
            )}
          </>
        }
      />
    );
  }
}

export default BuildPendingDialog;
