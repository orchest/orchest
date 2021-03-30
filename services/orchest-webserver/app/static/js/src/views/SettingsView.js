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
import ConfigureJupyterLabView from "./ConfigureJupyterLabView";
import _ from "lodash";

class SettingsView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      status: "...",
      restarting: false,
      // text representation of config object, filtered for certain keys
      config: undefined,
      // the full JSON config object
      configJSON: undefined,
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
        let visibleJSON = this.configToVisibleConfig(configJSON);

        this.setState({
          configJSON,
          config: JSON.stringify(visibleJSON, null, 2),
        });
      } catch (error) {
        console.warn("Received invalid JSON config from the server.");
      }
    });
  }

  onClickManageUsers() {
    orchest.loadView(ManageUsersView);
  }

  configToVisibleConfig(configJSON) {
    if (orchest.config["CLOUD"] !== true) {
      return configJSON;
    }

    let visibleJSON = _.cloneDeep(configJSON);

    // strip cloud config
    for (let key of orchest.config["CLOUD_UNMODIFIABLE_CONFIG_VALUES"]) {
      delete visibleJSON[key];
    }

    return visibleJSON;
  }

  configToInvisibleConfig(configJSON) {
    if (orchest.config["CLOUD"] !== true) {
      return {};
    }

    let invisibleJSON = _.cloneDeep(configJSON);

    // Strip visible config
    for (let key of Object.keys(invisibleJSON)) {
      if (
        orchest.config["CLOUD_UNMODIFIABLE_CONFIG_VALUES"].indexOf(key) === -1
      ) {
        delete invisibleJSON[key];
      }
    }

    return invisibleJSON;
  }

  saveConfig(config) {
    let formData = new FormData();

    try {
      let visibleJSON = JSON.parse(config);
      let invisibleConfigJSON = this.configToInvisibleConfig(
        this.state.configJSON
      );
      let joinedConfig = { ...invisibleConfigJSON, ...visibleJSON };

      formData.append("config", JSON.stringify(joinedConfig));

      let authWasEnabled = this.state.configJSON.AUTH_ENABLED;

      this.setState({
        configJSON: joinedConfig,
        unsavedChanges: false,
      });

      makeRequest("POST", "/async/user-config", {
        type: "FormData",
        content: formData,
      })
        .catch((e) => {
          console.error(e);
        })
        .then((data) => {
          let shouldReload = false;

          try {
            let configJSON = JSON.parse(data);

            this.setState({
              configJSON,
            });

            this.setState({
              config: JSON.stringify(
                this.configToVisibleConfig(configJSON),
                null,
                2
              ),
            });

            // Refresh the page when auth gets enabled in the config.
            shouldReload = configJSON.AUTH_ENABLED && !authWasEnabled;
          } catch (error) {
            console.warn("Received invalid JSON config from the server.");
          }

          if (shouldReload) {
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

        makeRequest("POST", "/async/restart")
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

  loadConfigureJupyterLab() {
    orchest.loadView(ConfigureJupyterLabView);
  }

  render() {
    updateGlobalUnsavedChanges(this.state.unsavedChanges);

    return (
      <div className={"view-page global-settings"}>
        <h2>Global settings</h2>
        <div className="push-down">
          <div>
            <p className="push-down">
              Enabling authentication through{" "}
              <span className="code">AUTH_ENABLED</span> will automatically
              redirect you to the login page, so make sure you have set up a
              user first!
            </p>

            {(() => {
              if (this.state.config === undefined) {
                return <p>Loading config...</p>;
              } else {
                return (
                  <div className="push-up">
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
                      if (orchest.config.CLOUD === true) {
                        return (
                          <div className="push-up notice">
                            <p>
                              {" "}
                              Note that{" "}
                              {orchest.config[
                                "CLOUD_UNMODIFIABLE_CONFIG_VALUES"
                              ].map((el, i) => (
                                <span key={i}>
                                  <span className="code">{el}</span>
                                  {i !=
                                    orchest.config[
                                      "CLOUD_UNMODIFIABLE_CONFIG_VALUES"
                                    ].length -
                                      1 && <span>, </span>}
                                </span>
                              ))}{" "}
                              cannot be modified when running in the{" "}
                              <span className="code">cloud</span>.
                            </p>
                          </div>
                        );
                      }
                    })()}

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

        <h3>JupyterLab configuration</h3>
        <div className="columns">
          <div className="column">
            <p>Configure JupyterLab by installing server extensions.</p>
          </div>
          <div className="column">
            <MDCButtonReact
              classNames={["mdc-button--outlined"]}
              label="Configure JupyterLab"
              icon="tune"
              onClick={this.loadConfigureJupyterLab.bind(this)}
            />
          </div>
          <div className="clear"></div>
        </div>

        <h3>Version information</h3>
        <div className="columns">
          <div className="column">
            <p>Find out Orchest's version.</p>
          </div>
          <div className="column">
            {(() => {
              if (this.state.version !== undefined) {
                return <p>{this.state.version}</p>;
              } else {
                return (
                  <Fragment>
                    <MDCLinearProgressReact classNames={["push-down"]} />
                  </Fragment>
                );
              }
            })()}
            {(() => {
              if (orchest.config.FLASK_ENV === "development") {
                return (
                  <p>
                    <span className="code">development mode</span>
                  </p>
                );
              }
            })()}
          </div>
          <div className="clear"></div>
        </div>

        <h3>Updates</h3>
        <div className="columns">
          <div className="column">
            <p>Update Orchest from the web UI using the built in updater.</p>
          </div>
          <div className="column">
            <MDCButtonReact
              classNames={["mdc-button--outlined"]}
              label="Check for updates"
              icon="system_update_alt"
              onClick={this.updateView.bind(this)}
            />
          </div>
          <div className="clear"></div>
        </div>

        <h3>Controls</h3>
        <div className="columns">
          <div className="column">
            <p>
              Restart Orchest will force quit ongoing builds, jobs and sessions.
            </p>
          </div>
          <div className="column">
            {(() => {
              if (!this.state.restarting) {
                return (
                  <Fragment>
                    <MDCButtonReact
                      classNames={["mdc-button--outlined"]}
                      label="Restart"
                      icon="power_settings_new"
                      onClick={this.restartOrchest.bind(this)}
                    />
                  </Fragment>
                );
              } else {
                return (
                  <Fragment>
                    <MDCLinearProgressReact classNames={["push-down"]} />
                    <p>Restarting... This can take up to 30 seconds.</p>
                  </Fragment>
                );
              }
            })()}
            <p className="push-up">
              Orchest's current status is <i>{this.state.status}</i>.
            </p>
          </div>
          <div className="clear"></div>
        </div>

        <h3>Authentication</h3>
        <div className="columns">
          <div className="column">
            <p>Manage Orchest users using the user admin panel.</p>
          </div>
          <div className="column">
            <MDCButtonReact
              classNames={["mdc-button--outlined"]}
              onClick={this.onClickManageUsers.bind(this)}
              icon="people"
              label="Manage users"
            />
          </div>
          <div className="clear"></div>
        </div>
      </div>
    );
  }
}

export default SettingsView;
