import React, { Fragment } from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import { updateGlobalUnsavedChanges } from "../utils/webserver-utils";
import {
  makeRequest,
  checkHeartbeat,
  PromiseManager,
  makeCancelable,
} from "../lib/utils/all";
import UpdateView from "./UpdateView";
import ManageUsersView from "./ManageUsersView";
import { Controlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/javascript/javascript";

class SettingsView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      status: "...",
      restarting: false,
      config: undefined,
      version: undefined,
      unsavedChanges: false,
    };

    this.promiseManager = new PromiseManager();
  }

  componentWillUnmount() {}

  componentDidMount() {
    this.checkOrchestStatus();
    this.getConfig();
    this.getVersion();
  }

  updateView() {
    orchest.loadView(UpdateView);
  }

  getVersion() {
    makeRequest("GET", "/async/version").then((data) => {
      this.setState({
        version: data,
      });
    });
  }

  getConfig() {
    let getConfigPromise = makeCancelable(
      makeRequest("GET", "/async/user-config"),
      this.promiseManager
    );

    getConfigPromise.promise.then((data) => {
      try {
        let configJSON = JSON.parse(data);

        this.setState({
          configJSON,
        });
      } catch (error) {
        console.warn("Received invalid JSON config from the server.");
      }

      this.setState({
        config: data,
      });
    });
  }

  onClickManageUsers() {
    orchest.loadView(ManageUsersView);
  }

  saveConfig(config) {
    let formData = new FormData();

    try {
      let configJSON = JSON.parse(config);
      formData.append("config", config);

      let authWasEnabled = this.state.configJSON.AUTH_ENABLED;

      this.setState({
        configJSON,
        unsavedChanges: false,
      });

      makeRequest("POST", "/async/user-config", {
        type: "FormData",
        content: formData,
      })
        .catch((e) => {
          console.error(e);
        })
        .then(() => {
          // refresh the page when auth gets enabled in the config
          if (configJSON.AUTH_ENABLED && !authWasEnabled) {
            location.reload();
          }
        });
    } catch (error) {
      console.error(error);
      console.error("Tried to save config which is invalid JSON.");
      console.error(config);
    }
  }

  checkOrchestStatus() {
    let checkOrchestPromise = makeCancelable(
      makeRequest("GET", "/heartbeat"),
      this.promiseManager
    );

    checkOrchestPromise.promise
      .then(() => {
        this.setState({
          status: "online",
        });
      })
      .catch((e) => {
        if (!e.isCanceled) {
          this.setState({
            status: "offline",
          });
        }
      });
  }

  restartOrchest() {
    orchest.confirm(
      "Warning",
      "Are you sure you want to restart Orchest? This will kill all running Orchest containers (including kernels/pipelines).",
      () => {
        this.setState({
          restarting: true,
          status: "restarting",
        });

        let restartURL = "/async/restart";
        if (orchest.environment === "development") {
          restartURL += "?mode=dev";
        }

        makeRequest("POST", restartURL)
          .then(() => {
            setTimeout(() => {
              checkHeartbeat("/heartbeat")
                .then(() => {
                  console.log("Orchest available");
                  this.setState({
                    restarting: false,
                    status: "online",
                  });
                })
                .catch((retries) => {
                  console.log(
                    "Update service heartbeat checking timed out after " +
                      retries +
                      " retries."
                  );
                });
            }, 5000); // allow 5 seconds for orchest-ctl to stop orchest
          })
          .catch((e) => {
            console.log(e);
            console.error("Could not trigger restart.");
          });
      }
    );
  }

  render() {
    updateGlobalUnsavedChanges(this.state.unsavedChanges);

    return (
      <div className={"view-page"}>
        <h2>Global settings</h2>
        <div className="push-down">
          <div>
            <p className="push-down">
              These settings are stored in{" "}
              <span className="code">config.json</span>.
            </p>

            {(() => {
              if (this.state.config === undefined) {
                return <p>Loading config...</p>;
              } else {
                return (
                  <div>
                    <CodeMirror
                      value={this.state.config}
                      options={{
                        mode: "application/json",
                        theme: "jupyter",
                        lineNumbers: true,
                      }}
                      onBeforeChange={(editor, data, value) => {
                        this.setState({
                          config: value,
                          unsavedChanges: this.state.config != value,
                        });
                      }}
                    />

                    {(() => {
                      try {
                        JSON.parse(this.state.config);
                      } catch {
                        return (
                          <div className="warning push-up">
                            <i className="material-icons">warning</i> Your input
                            is not valid JSON.
                          </div>
                        );
                      }
                    })()}

                    <MDCButtonReact
                      classNames={[
                        "push-up",
                        "mdc-button--raised",
                        "themed-secondary",
                      ]}
                      label={this.state.unsavedChanges ? "SAVE*" : "SAVE"}
                      icon="save"
                      onClick={this.saveConfig.bind(this, this.state.config)}
                    />
                  </div>
                );
              }
            })()}
          </div>
        </div>

        <h2>Version information</h2>
        <div>
          {(() => {
            if (this.state.version !== undefined) {
              return <p className="push-down">{this.state.version}</p>;
            } else {
              return (
                <Fragment>
                  <MDCLinearProgressReact classNames={["push-down"]} />
                </Fragment>
              );
            }
          })()}
          <p className={"push-down"}>
            Application mode:{" "}
            <span className="code">{orchest.environment}</span>.
          </p>
        </div>

        <h2>Updates</h2>
        <div className="push-down">
          <MDCButtonReact
            label="Check for updates"
            icon="system_update_alt"
            onClick={this.updateView.bind(this)}
          />
        </div>

        <h2>Controls</h2>
        <div className="push-down">
          <p className="push-down">
            Orchest's current status is <i>{this.state.status}</i>.
          </p>
          {(() => {
            if (!this.state.restarting) {
              return (
                <Fragment>
                  <MDCButtonReact
                    label="Restart"
                    icon="power_settings_new"
                    onClick={this.restartOrchest.bind(this)}
                  />
                </Fragment>
              );
            } else {
              return (
                <Fragment>
                  <MDCLinearProgressReact
                    classNames={["push-up", "push-down"]}
                  />
                  <p>Restarting... This can take up to 30 seconds.</p>
                </Fragment>
              );
            }
          })()}
        </div>

        <h2>Authentication</h2>
        <MDCButtonReact
          onClick={this.onClickManageUsers.bind(this)}
          icon="people"
          label="Manage users"
        />
      </div>
    );
  }
}

export default SettingsView;
