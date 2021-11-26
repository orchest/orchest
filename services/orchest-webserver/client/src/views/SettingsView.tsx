import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useOrchest } from "@/hooks/orchest";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import LinearProgress from "@mui/material/LinearProgress";
import { MDCButtonReact } from "@orchest/lib-mdc";
import {
  checkHeartbeat,
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import _ from "lodash";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";

const SettingsView: React.FC = () => {
  const { orchest } = window;
  useSendAnalyticEvent("view load", { name: siteMap.settings.path });

  const { navigateTo } = useCustomRoute();
  const context = useOrchest();
  const { setAlert } = useAppContext();

  const [state, setState] = React.useState({
    status: "...",
    restarting: false,
    // text representation of config object, filtered for certain keys
    config: undefined,
    // the full JSON config object
    configJSON: undefined,
    version: undefined,
    hostInfo: undefined,
    // changed config options that require an Orchest restart
    requiresRestart: [],
  });

  const [promiseManager] = React.useState(new PromiseManager());

  const updateView = () => {
    navigateTo(siteMap.update.path);
  };

  const getVersion = () => {
    makeRequest("GET", "/async/version").then((data) => {
      setState((prevState) => ({ ...prevState, version: data }));
    });
  };

  const getHostInfo = () => {
    makeRequest("GET", "/async/host-info")
      .then((data: string) => {
        try {
          let parsed_data = JSON.parse(data);
          setState((prevState) => ({ ...prevState, hostInfo: parsed_data }));
        } catch (error) {
          console.warn("Received invalid host-info JSON from the server.");
        }
      })
      .catch(console.error);
  };

  const getConfig = () => {
    let getConfigPromise = makeCancelable(
      makeRequest("GET", "/async/user-config"),
      promiseManager
    );

    getConfigPromise.promise
      .then((data) => {
        try {
          let configJSON = JSON.parse(data);
          configJSON = configJSON.user_config;
          let visibleJSON = configToVisibleConfig(configJSON);

          setState((prevState) => ({
            ...prevState,
            configJSON,
            config: JSON.stringify(visibleJSON, null, 2),
          }));
        } catch (error) {
          console.warn("Received invalid JSON config from the server.");
        }
        // Needs to be here in case the request is cancelled, will otherwise
        // result in an uncaught error that can throw off cypress.
      })
      .catch((error) => console.log(error));
  };

  const onClickManageUsers = () => {
    navigateTo(siteMap.manageUsers.path);
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

      setState((prevState) => ({
        ...prevState,
        configJSON: joinedConfig,
      }));

      context.dispatch({
        type: "setUnsavedChanges",
        payload: false,
      });

      makeRequest("POST", "/async/user-config", {
        type: "FormData",
        content: formData,
      })
        .catch((e) => {
          console.error(e);
          setAlert({ content: JSON.parse(e.body).message });
        })
        .then((data: string) => {
          try {
            let responseJSON = JSON.parse(data);
            let requiresRestart = responseJSON.requires_restart;
            let configJSON = responseJSON.user_config;

            setState((prevState) => ({
              ...prevState,
              configJSON,
              requiresRestart,
              config: JSON.stringify(
                configToVisibleConfig(configJSON),
                null,
                2
              ),
            }));
          } catch (error) {
            console.warn("Received invalid JSON config from the server.");
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
          requiresRestart: [],
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
    navigateTo(siteMap.configureJupyterLab.path);
  };

  React.useEffect(() => {
    checkOrchestStatus();
    getConfig();
    getHostInfo();
    getVersion();
  }, []);

  return (
    <Layout>
      <div className={"view-page orchest-settings"}>
        <h2>Orchest settings</h2>
        <div className="push-down">
          <div>
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
                        }));
                        context.dispatch({
                          type: "setUnsavedChanges",
                          payload: state.config != value,
                        });
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
                    {(() => {
                      if (state.requiresRestart.length > 0) {
                        let vals = state.requiresRestart.map(
                          (val) => `"${val}" `
                        );
                        return (
                          <div className="warning push-up">
                            <i className="material-icons">info</i> Restart
                            Orchest for the changes to {vals} to take effect.
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
                      label={context.state.unsavedChanges ? "SAVE*" : "SAVE"}
                      icon="save"
                      onClick={() => saveConfig(state.config)}
                    />
                  </div>
                );
              }
            })()}
          </div>
        </div>

        <h3>System status</h3>
        <div className="columns">
          <div className="column">
            <p>Version information.</p>
          </div>
          <div className="column">
            {state.version ? (
              <p>{state.version}</p>
            ) : (
              <LinearProgress className="push-down" />
            )}
            {context.state?.config?.FLASK_ENV === "development" && (
              <p>
                <span className="code">development mode</span>
              </p>
            )}
          </div>
          <div className="clear"></div>
        </div>
        <div className="columns">
          <div className="column">
            <p>Disk usage.</p>
          </div>
          <div className="column">
            {(() => {
              if (state.hostInfo !== undefined) {
                return (
                  <>
                    <LinearProgress
                      className="disk-size-info"
                      variant="determinate"
                      value={state.hostInfo.disk_info.used_pcent}
                    />

                    <div className="disk-size-info push-up-half">
                      <span>
                        {state.hostInfo.disk_info.used_GB + "GB used"}
                      </span>
                      <span className="float-right">
                        {state.hostInfo.disk_info.avail_GB + "GB free"}
                      </span>
                    </div>
                  </>
                );
              } else {
                return <LinearProgress className="push-down disk-size-info" />;
              }
            })()}
          </div>
        </div>
        <div className="clear"></div>

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
              onClick={loadConfigureJupyterLab}
            />
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
              onClick={updateView}
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
                  <MDCButtonReact
                    classNames={["mdc-button--outlined"]}
                    label="Restart"
                    icon="power_settings_new"
                    onClick={restartOrchest}
                    data-test-id="restart"
                  />
                );
              } else {
                return (
                  <>
                    <LinearProgress className="push-down" />
                    <p>This can take up to 30 seconds.</p>
                  </>
                );
              }
            })()}
            <p className="push-up">
              {`Orchest's current status is `}
              <i>{state.status}</i>
              {`.`}
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
              onClick={onClickManageUsers}
              icon="people"
              label="Manage users"
              data-test-id="manage-users"
            />
          </div>
          <div className="clear"></div>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsView;
