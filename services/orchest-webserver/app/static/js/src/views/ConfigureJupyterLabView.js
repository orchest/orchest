import { Controlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/shell/shell";
import React from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import ImageBuildLog from "../components/ImageBuildLog";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import {
  uuidv4,
  makeRequest,
  makeCancelable,
  RefManager,
  PromiseManager,
} from "../lib/utils/all";
import { updateGlobalUnsavedChanges } from "../utils/webserver-utils";

class ConfigureJupyterLabView extends React.Component {
  constructor() {
    super();

    this.CANCELABLE_STATUSES = ["PENDING", "STARTED"];

    this.state = {
      unsavedChanges: false,
      building: false,
      ignoreIncomingLogs: false,
      jupyterBuild: undefined,
      buildFetchHash: uuidv4(),
      jupyterSetupScript: undefined,
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidMount() {
    this.getSetupScript();
  }

  onBuildStart() {
    this.setState({
      ignoreIncomingLogs: false,
    });
  }

  onUpdateBuild(jupyterBuild) {
    this.setState({
      building: this.CANCELABLE_STATUSES.indexOf(jupyterBuild.status) !== -1,
      jupyterBuild,
    });
  }

  buildImage() {
    orchest.jupyter.unload();

    this.save(() => {
      this.setState({
        building: true,
        ignoreIncomingLogs: true,
      });

      let buildPromise = makeCancelable(
        makeRequest("POST", "/catch/api-proxy/api/jupyter-builds"),
        this.promiseManager
      );

      buildPromise.promise
        .then((response) => {
          try {
            let jupyterBuild = JSON.parse(response)["jupyter_build"];
            this.onUpdateBuild(jupyterBuild);
          } catch (error) {
            console.error(error);
          }
        })
        .catch((error) => {
          this.setState({
            building: false,
            ignoreIncomingLogs: false,
          });

          try {
            let resp = JSON.parse(error.body);

            if (resp.message == "SessionInProgressException") {
              orchest.alert(
                "Error",
                "You must stop all active sessions in order to build a new JupyerLab image."
              );
            }
          } catch (error) {
            console.error(error);
          }
          console.log(error);
        });
    });
  }

  cancelImageBuild() {
    // send DELETE to cancel ongoing build
    if (
      this.state.jupyterBuild &&
      this.CANCELABLE_STATUSES.indexOf(this.state.jupyterBuild.status) !== -1
    ) {
      makeRequest(
        "DELETE",
        `/catch/api-proxy/api/jupyter-builds/${this.state.jupyterBuild.uuid}`
      )
        .then(() => {
          // immediately fetch latest status
          // NOTE: this DELETE call doesn't actually destroy the resource, that's
          // why we're querying it again.
          this.setState({
            buildFetchHash: uuidv4(),
          });
        })
        .catch((error) => {
          console.error(error);
        });

      this.setState({
        building: false,
      });
    } else {
      orchest.alert(
        "Could not cancel build, please try again in a few seconds."
      );
    }
  }

  getSetupScript() {
    let getSetupScriptPromise = makeCancelable(
      makeRequest("GET", "/async/jupyter-setup-script"),
      this.promiseManager
    );
    getSetupScriptPromise.promise.then((response) => {
      this.setState({
        jupyterSetupScript: response,
      });
    });
  }

  save(cb) {
    this.setState({
      unsavedChanges: false,
    });
    // auto save the bash script
    let formData = new FormData();

    formData.append("setup_script", this.state.jupyterSetupScript);
    makeRequest("POST", "/async/jupyter-setup-script", {
      type: "FormData",
      content: formData,
    })
      .then(() => {
        if (cb) {
          cb();
        }
      })
      .catch((e) => {
        console.error(e);
      });
  }

  render() {
    updateGlobalUnsavedChanges(this.state.unsavedChanges);

    return (
      <div className={"view-page jupyterlab-config-page"}>
        {this.state.jupyterSetupScript !== undefined ? (
          <>
            <h2>Configure JupyterLab</h2>
            <p className="push-down">
              You can install JupyterLab extensions using the bash script below.
            </p>

            <div className="push-down">
              <CodeMirror
                value={this.state.jupyterSetupScript}
                options={{
                  mode: "application/x-sh",
                  theme: "jupyter",
                  lineNumbers: true,
                  viewportMargin: Infinity,
                }}
                onBeforeChange={(editor, data, value) => {
                  this.setState({
                    jupyterSetupScript: value,
                    unsavedChanges: true,
                  });
                }}
              />
            </div>

            <ImageBuildLog
              buildFetchHash={this.state.buildFetchHash}
              buildRequestEndpoint={
                "/catch/api-proxy/api/jupyter-builds/most-recent"
              }
              buildsKey="jupyter_builds"
              socketIONamespace={
                orchest.config["ORCHEST_SOCKETIO_JUPYTER_BUILDING_NAMESPACE"]
              }
              streamIdentity={"jupyter"}
              onUpdateBuild={this.onUpdateBuild.bind(this)}
              onBuildStart={this.onBuildStart.bind(this)}
              ignoreIncomingLogs={this.state.ignoreIncomingLogs}
              build={this.state.jupyterBuild}
              building={this.state.building}
            />

            <MDCButtonReact
              label={this.state.unsavedChanges ? "Save*" : "Save"}
              icon="save"
              classNames={[
                "mdc-button--raised",
                "themed-secondary",
                "push-right",
              ]}
              submitButton
              onClick={this.save.bind(this)}
            />

            {!this.state.building ? (
              <MDCButtonReact
                label="Build"
                icon="memory"
                classNames={["mdc-button--raised"]}
                onClick={this.buildImage.bind(this)}
              />
            ) : (
              <MDCButtonReact
                label="Cancel build"
                icon="close"
                classNames={["mdc-button--raised"]}
                onClick={this.cancelImageBuild.bind(this)}
              />
            )}
          </>
        ) : (
          <MDCLinearProgressReact />
        )}
      </div>
    );
  }
}

export default ConfigureJupyterLabView;
