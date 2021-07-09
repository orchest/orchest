import * as React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import _ from "lodash";
import "codemirror/mode/javascript/javascript";
import { MDCButtonReact, MDCLinearProgressReact } from "@orchest/lib-mdc";
import {
  makeRequest,
  checkHeartbeat,
  PromiseManager,
  makeCancelable,
} from "@orchest/lib-utils";
import { useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import UpdateView from "@/views/UpdateView";
import ManageUsersView from "@/views/ManageUsersView";
import ConfigureJupyterLabView from "@/views/ConfigureJupyterLabView";

const SettingsView: React.FC<any> = () => {
  const { orchest } = window;

  const context = useOrchest();

  const [state, setState] = React.useState({
    status: "...",
    restarting: false,
    // text representation of config object, filtered for certain keys
    config: undefined,
    // the full JSON config object
    configJSON: undefined,
    version: undefined,
    unsavedChanges: false,
  });
  const [promiseManager] = React.useState(new PromiseManager());

  const updateView = () => {
    orchest.loadView(UpdateView);
  };

  const getVersion = () => {
    makeRequest("GET", "/async/version").then((data) => {
      setState((prevState) => ({ ...prevState, version: data }));
    });
  };

  const getConfig = () => {
    let getConfigPromise = makeCancelable(
      makeRequest("GET", "/async/user-config"),
      promiseManager
    );

    getConfigPromise.promise.then((data) => {
      try {
        let configJSON = JSON.parse(data);
        let visibleJSON = configToVisibleConfig(configJSON);

        setState((prevState) => ({
          ...prevState,
          configJSON,
          config: JSON.stringify(visibleJSON, null, 2),
        }));
      } catch (error) {
        console.warn("Received invalid JSON config from the server.");
      }
    });
  };

  const onClickManageUsers = () => {
    orchest.loadView(ManageUsersView);
  };

  const configToVisibleConfig = (configJSON) => {
    if (context.state?.config["CLOUD"] !== true) {
      return configJSON;
    }

    let visibleJSON = _.cloneDeep(configJSON);

    // strip cloud config
    for (let key of context.state?.config["CLOUD_UNMODIFIABLE_CONFIG_VALUES"]) {
      delete visibleJSON[key];
    }

    return visibleJSON;
  };

  const configToInvisibleConfig = (configJSON) => {
    if (context.state?.config["CLOUD"] !== true) {
      return {};
    }

    let invisibleJSON = _.cloneDeep(configJSON);

    // Strip visible config
    for (let key of Object.keys(invisibleJSON)) {
      if (
        context.state?.config["CLOUD_UNMODIFIABLE_CONFIG_VALUES"].indexOf(
          key
        ) === -1
      ) {
        delete invisibleJSON[key];
      }
    }

    return invisibleJSON;
  };

  const saveConfig = (config) => {
    let formData = new FormData();

    try {
      let visibleJSON = JSON.parse(config);
      let invisibleConfigJSON = configToInvisibleConfig(state.configJSON);
      let joinedConfig = { ...invisibleConfigJSON, ...visibleJSON };

      formData.append("config", JSON.stringify(joinedConfig));

      let authWasEnabled = state.configJSON.AUTH_ENABLED;

      setState((prevState) => ({
        ...prevState,
        configJSON: joinedConfig,
        unsavedChanges: false,
      }));

      makeRequest("POST", "/async/user-config", {
        type: "FormData",
        content: formData,
      })
        .catch((e) => {
          console.error(e);
        })
        .then((data: string) => {
          let shouldReload = false;

          try {
            let configJSON = JSON.parse(data);

            setState((prevState) => ({
              ...prevState,
              configJSON,
              config: JSON.stringify(
                configToVisibleConfig(configJSON),
                null,
                2
              ),
            }));

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
  };

  const checkOrchestStatus = () => {
    let checkOrchestPromise = makeCancelable(
      makeRequest("GET", "/heartbeat"),
      promiseManager
    );

    checkOrchestPromise.promise
      .then(() => {
        setState((prevState) => ({
          ...prevState,
          status: "online",
        }));
      })
      .catch((e) => {
        if (!e.isCanceled) {
          setState((prevState) => ({
            ...prevState,
            status: "offline",
          }));
        }
      });
  };

  const restartOrchest = () => {
    orchest.confirm(
      "Warning",
      "Are you sure you want to restart Orchest? This will kill all running Orchest containers (including kernels/pipelines).",
      () => {
        setState((prevState) => ({
          ...prevState,
          restarting: true,
          status: "restarting",
        }));

        makeRequest("POST", "/async/restart")
          .then(() => {
            setTimeout(() => {
              checkHeartbeat("/heartbeat")
                .then(() => {
                  console.log("Orchest available");
                  setState((prevState) => ({
                    ...prevState,
                    restarting: false,
                    status: "online",
                  }));
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
  };

  const loadConfigureJupyterLab = () => {
    orchest.loadView(ConfigureJupyterLabView);
  };

  React.useEffect(() => {
    checkOrchestStatus();
    getConfig();
    getVersion();
  }, []);

  React.useEffect(() => {
    context.dispatch({
      type: "setUnsavedChanges",
      payload: state.unsavedChanges,
    });
  }, [state.unsavedChanges]);

  return (
    <Layout>
      <div className={"view-page orchest-settings"}>
        <h2>Orchest settings</h2>
        <div className="push-down">
          <div>
            <p className="push-down">
              Enabling authentication through{" "}
              <span className="code">AUTH_ENABLED</span> will automatically
              redirect you to the login page, so make sure you have set up a
              user first!
            </p>

            {(() => {
              if (state.config === undefined) {
                return <p>Loading config...</p>;
              } else {
                return (
                  <div className="push-up">
                    <CodeMirror
                      value={state.config}
                      options={{
                        mode: "application/json",
                        theme: "jupyter",
                        lineNumbers: true,
                      }}
                      onBeforeChange={(editor, data, value) => {
                        setState((prevState) => ({
                          ...prevState,
                          config: value,
                          unsavedChanges: state.config != value,
                        }));
                      }}
                    />

                    {(() => {
                      if (context.state?.config?.CLOUD === true) {
                        return (
                          <div className="push-up notice">
                            <p>
                              {" "}
                              Note that{" "}
                              {context.state?.config[
                                "CLOUD_UNMODIFIABLE_CONFIG_VALUES"
                              ].map((el, i) => (
                                <span key={i}>
                                  <span className="code">{el}</span>
                                  {i !=
                                    context.state?.config[
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
                        JSON.parse(state.config);
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
                      label={state.unsavedChanges ? "SAVE*" : "SAVE"}
                      icon="save"
                      onClick={saveConfig.bind(this, state.config)}
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
              onClick={loadConfigureJupyterLab.bind(this)}
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
              if (state.version !== undefined) {
                return <p>{state.version}</p>;
              } else {
                return (
                  <React.Fragment>
                    <MDCLinearProgressReact classNames={["push-down"]} />
                  </React.Fragment>
                );
              }
            })()}
            {(() => {
              if (context.state?.config?.FLASK_ENV === "development") {
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
              onClick={updateView.bind(this)}
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
              if (!state.restarting) {
                return (
                  <React.Fragment>
                    <MDCButtonReact
                      classNames={["mdc-button--outlined"]}
                      label="Restart"
                      icon="power_settings_new"
                      onClick={restartOrchest.bind(this)}
                    />
                  </React.Fragment>
                );
              } else {
                return (
                  <React.Fragment>
                    <MDCLinearProgressReact classNames={["push-down"]} />
                    <p>This can take up to 30 seconds.</p>
                  </React.Fragment>
                );
              }
            })()}
            <p className="push-up">
              Orchest's current status is <i>{state.status}</i>.
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
              onClick={onClickManageUsers.bind(this)}
              icon="people"
              label="Manage users"
            />
          </div>
          <div className="clear"></div>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsView;
