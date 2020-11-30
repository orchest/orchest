import React, { Fragment } from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCCheckboxReact from "../lib/mdc-components/MDCCheckboxReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import MDCSelectReact from "../lib/mdc-components/MDCSelectReact";
import {
  checkHeartbeat,
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
} from "../lib/utils/all";

class UpdateView extends React.Component {
  constructor() {
    super();

    this.state = {
      updating: false,
      updateOutput: "",
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  startUpdateTrigger() {
    orchest.confirm(
      "Warning",
      "Are you sure you want to update Orchest? This will kill all running Orchest containers (including kernels/pipelines).",
      () => {
        this.setState({
          updating: true,
          updateOutput: "",
        });

        makeRequest("GET", "/async/spawn-update-server", {})
          .then(() => {
            console.log("Spawned update-server, start polling update-server.");

            checkHeartbeat("/update-server/heartbeat")
              .then(() => {
                console.log("Update service available");
                this.requestUpdate();
              })
              .catch((retries) => {
                console.log(
                  "Update service heartbeat checking timed out after " +
                    retries +
                    " retries."
                );
              });
          })
          .catch((e) => {
            console.log("Failed to trigger update", e);
          });
      }
    );
  }

  requestUpdate() {
    let _this = this;

    let updateUrl = "/update-server/update";

    if (orchest.environment === "development") {
      updateUrl += "?mode=dev";
    }
    let data = {
      mode: orchest.environment ? "dev" : "reg",
      gpu: this.refManager.refs.formGPU.mdc.checked ? "gpu" : "no-gpu",
      language: this.refManager.refs.formLanguage.mdc.value,
    };

    let updatePromise = makeCancelable(
      makeRequest(
        "POST",
        updateUrl,
        {
          type: "json",
          content: data,
        },
        function () {
          _this.setState({
            updateOutput: this.responseText,
          });
        },
        0
      ),
      this.promiseManager
    ); // 0 means no timeout.

    updatePromise.promise.then((response) => {
      this.setState({
        updateOutput: response,
        updating: false,
      });
    });
  }

  render() {
    return (
      <div className={"view-page update-page"}>
        <h2>Orchest updater</h2>
        <p className="push-down">Update Orchest to the latest version.</p>

        {(() => {
          let elements = [];

          if (this.state.updating) {
            elements.push(
              <MDCLinearProgressReact key="0" classNames={["push-down"]} />
            );
          }
          if (this.state.updateOutput.length > 0) {
            elements.push(
              <div key="1" className="console-output">
                {this.state.updateOutput}
              </div>
            );
          }

          return (
            <Fragment>
              <div>
                <h3 className="push-down">Update options</h3>
                <MDCSelectReact
                  label="Language images"
                  options={[
                    ["minimal", "Minimal"],
                    ["python", "Python"],
                    ["r", "R"],
                    ["all", "All"],
                  ]}
                  classNames={["push-down"]}
                  value="python"
                  ref={this.refManager.nrefs.formLanguage}
                />
                <MDCCheckboxReact
                  label="GPU support"
                  ref={this.refManager.nrefs.formGPU}
                  classNames={["push-down"]}
                />
              </div>

              <MDCButtonReact
                classNames={["push-down"]}
                label="Start update"
                icon="system_update_alt"
                disabled={this.state.updating}
                onClick={this.startUpdateTrigger.bind(this)}
              />

              {elements}
            </Fragment>
          );
        })()}
      </div>
    );
  }
}

export default UpdateView;
