import { Code } from "@/components/common/Code";
import { PageTitle } from "@/components/common/PageTitle";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useCheckUpdate } from "@/hooks/useCheckUpdate";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import StyledButtonOutlined from "@/styled-components/StyledButton";
import PeopleIcon from "@mui/icons-material/People";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import SaveIcon from "@mui/icons-material/Save";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import TuneIcon from "@mui/icons-material/Tune";
import { Typography } from "@mui/material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import {
  checkHeartbeat,
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import cloneDeep from "lodash.clonedeep";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";

const SettingsView: React.FC = () => {
  const { navigateTo } = useCustomRoute();
  const {
    setAlert,
    setAsSaved,
    setConfirm,
    state: { config, hasUnsavedChanges },
  } = useAppContext();

  useSendAnalyticEvent("view load", { name: siteMap.settings.path });

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

  const getVersion = () => {
    makeRequest("GET", "/async/version").then((data) => {
      let parsed_data = JSON.parse(data);
      setState((prevState) => ({ ...prevState, version: parsed_data.version }));
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

  const onClickManageUsers = (e: React.MouseEvent) => {
    navigateTo(siteMap.manageUsers.path, undefined, e);
  };

  const configToVisibleConfig = (configJSON) => {
    if (config.CLOUD !== true) {
      return configJSON;
    }

    let visibleJSON = cloneDeep(configJSON);

    // strip cloud config
    for (let key of config.CLOUD_UNMODIFIABLE_CONFIG_VALUES) {
      delete visibleJSON[key];
    }

    return visibleJSON;
  };

  const configToInvisibleConfig = (configJSON) => {
    if (config.CLOUD !== true) {
      return {};
    }

    let invisibleJSON = cloneDeep(configJSON);

    // Strip visible config
    for (let key of Object.keys(invisibleJSON)) {
      if (config.CLOUD_UNMODIFIABLE_CONFIG_VALUES.indexOf(key) === -1) {
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

      setAsSaved(true);

      makeRequest("POST", "/async/user-config", {
        type: "FormData",
        content: formData,
      })
        .catch((e) => {
          console.error(e);
          setAlert("Error", JSON.parse(e.body).message);
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
    return setConfirm(
      "Warning",
      "Are you sure you want to restart Orchest? This will kill all running Orchest containers (including kernels/pipelines).",
      async (resolve) => {
        setState((prevState) => ({
          ...prevState,
          restarting: true,
          status: "restarting",
          requiresRestart: [],
        }));
        try {
          await makeRequest("POST", "/async/restart");
          resolve(true);

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
          return true;
        } catch (error) {
          console.error(error);
          resolve(false);
          setAlert("Error", "Could not trigger restart.");
          return false;
        }
      }
    );
  };

  const loadConfigureJupyterLab = (e: React.MouseEvent) => {
    navigateTo(siteMap.configureJupyterLab.path, undefined, e);
  };

  const checkUpdate = useCheckUpdate();

  React.useEffect(() => {
    checkOrchestStatus();
    getConfig();
    getHostInfo();
    getVersion();
  }, []);

  return (
    <Layout>
      <div className={"view-page orchest-settings"}>
        <PageTitle>Orchest settings</PageTitle>
        <div className="push-down">
          <div>
            {state.config === undefined ? (
              <Typography>Loading config...</Typography>
            ) : (
              <Box>
                <CodeMirror
                  value={state.config}
                  options={{
                    mode: "application/json",
                    theme: "jupyter",
                    lineNumbers: true,
                  }}
                  onBeforeChange={(editor, data, value) => {
                    setState((prevState) => {
                      setAsSaved(prevState.config === value);
                      return {
                        ...prevState,
                        config: value,
                      };
                    });
                  }}
                />
                <Stack
                  direction="column"
                  spacing={2}
                  sx={{
                    marginTop: (theme) => theme.spacing(2),
                    marginBottom: (theme) => theme.spacing(2),
                  }}
                >
                  {(() => {
                    try {
                      JSON.parse(state.config);
                    } catch {
                      return (
                        <Alert severity="warning">
                          Your input is not valid JSON.
                        </Alert>
                      );
                    }
                  })()}
                  {state.requiresRestart.length > 0 && (
                    <Alert severity="info">{`Restart Orchest for the changes to ${state.requiresRestart
                      .map((val) => `"${val}"`)
                      .join(" ")} to take effect.`}</Alert>
                  )}
                </Stack>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() => saveConfig(state.config)}
                >
                  {hasUnsavedChanges ? "SAVE*" : "SAVE"}
                </Button>
              </Box>
            )}
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
            {config.FLASK_ENV === "development" && (
              <p>
                <Code>development mode</Code>
              </p>
            )}
          </div>
          <div className="clear"></div>
        </div>
        {/* <div className="columns">
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
        <div className="clear"></div> */}

        <h3>JupyterLab configuration</h3>
        <div className="columns">
          <div className="column">
            <p>Configure JupyterLab by installing server extensions.</p>
          </div>
          <div className="column">
            <StyledButtonOutlined
              variant="outlined"
              color="secondary"
              startIcon={<TuneIcon />}
              onClick={loadConfigureJupyterLab}
              onAuxClick={loadConfigureJupyterLab}
            >
              Configure JupyterLab
            </StyledButtonOutlined>
          </div>
          <div className="clear"></div>
        </div>

        <h3>Updates</h3>
        <div className="columns">
          <div className="column">
            <p>Update Orchest from the web UI using the built in updater.</p>
          </div>
          <div className="column">
            <StyledButtonOutlined
              variant="outlined"
              color="secondary"
              startIcon={<SystemUpdateAltIcon />}
              onClick={checkUpdate}
              onAuxClick={checkUpdate}
            >
              Check for updates
            </StyledButtonOutlined>
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
                  <StyledButtonOutlined
                    variant="outlined"
                    color="secondary"
                    startIcon={<PowerSettingsNewIcon />}
                    onClick={restartOrchest}
                    data-test-id="restart"
                  >
                    Restart
                  </StyledButtonOutlined>
                );
              } else {
                return (
                  <>
                    <LinearProgress className="push-down" />
                    <p>This can take up to 1 minute.</p>
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
            <StyledButtonOutlined
              variant="outlined"
              color="secondary"
              onClick={onClickManageUsers}
              onAuxClick={onClickManageUsers}
              startIcon={<PeopleIcon />}
              data-test-id="manage-users"
            >
              Manage users
            </StyledButtonOutlined>
          </div>
          <div className="clear"></div>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsView;
