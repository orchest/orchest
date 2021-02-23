import React, { Fragment } from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
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
      "Are you sure you want to update Orchest?",
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

  startUpdatePolling() {
    clearInterval(this.updatePollInterval);

    this.updatePollInterval = setInterval(() => {
      let updateStatusPromise = makeCancelable(
        makeRequest("GET", "/update-server/update-status"),
        this.promiseManager,
        undefined,
        2000
      );

      updateStatusPromise.promise
        .then((response) => {
          this.setState({
            updateOutput: response,
          });
        })
        .catch((e) => {
          if (!e.isCanceled) {
            this.setState({
              updating: false,
            });
            clearInterval(this.updatePollInterval);
          }
        });
    }, 1000);
  }

  requestUpdate() {
    let updateUrl = "/update-server/update";
    let data = {
      mode: orchest.environment === "development" ? "dev" : "reg",
    };

    let updatePromise = makeCancelable(
      makeRequest("POST", updateUrl, {
        type: "json",
        content: data,
      }),
      this.promiseManager
    );
    updatePromise.promise
      .then(() => {
        this.startUpdatePolling();
      })
      .catch((e) => {
        console.error(e);
      });
  }

  render() {
    let updateOutputLines = this.state.updateOutput.split("\n").reverse();
    updateOutputLines =
      updateOutputLines[0] == ""
        ? updateOutputLines.slice(1)
        : updateOutputLines;

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
                {updateOutputLines.join("\n")}
              </div>
            );
          }

          return (
            <Fragment>
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
