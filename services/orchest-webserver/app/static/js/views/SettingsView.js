import React, { Fragment } from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import { makeRequest, checkHeartbeat } from "../lib/utils/all";
import UpdateView from "./UpdateView";
import ManageUsersView from "./ManageUsersView";
import { Controlled as CodeMirror } from "react-codemirror2";
require("codemirror/mode/javascript/javascript");

class SettingsView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      status: "...",
      restarting: false,
      config: undefined,
      version: undefined,
      configChangesPending: false,
    };
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
    makeRequest("GET", "/async/user-config").then((data) => {
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
    formData.append("config", config);

    this.setState({
      configChangesPending: false,
    });

    makeRequest("POST", "/async/user-config", {
      type: "FormData",
      content: formData,
    }).catch((e) => {
      console.error(e);
    });
  }

  checkOrchestStatus() {
    makeRequest("GET", "/heartbeat")
      .then(() => {
        this.setState({
          status: "online",
        });
      })
      .catch(() => {
        this.setState({
          status: "offline",
        });
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
                          configChangesPending: this.state.config != value,
                        });
                      }}
                    />

                    {(() => {
                      try {
                        JSON.parse(this.state.config);
                      } catch {
                        return (
                          <div className="json-warning">
                            <i className="material-icons">warning</i> Your input
                            is not valid JSON.
                          </div>
                        );
                      }
                    })()}

                    <MDCButtonReact
                      classNames={["push-up"]}
                      label="Save"
                      icon="save"
                      disabled={!this.state.configChangesPending}
                      onClick={this.saveConfig.bind(this, [this.state.config])}
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
