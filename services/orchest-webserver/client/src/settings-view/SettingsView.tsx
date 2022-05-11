import { Code } from "@/components/common/Code";
import { PageTitle } from "@/components/common/PageTitle";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useCheckUpdate } from "@/hooks/useCheckUpdate";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
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
import { checkHeartbeat, fetcher, hasValue } from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { useHostInfo } from "./hooks/useHostInfo";
import { useOrchestStatus } from "./hooks/useOrchestStatus";
import { useOrchestUserConfig } from "./hooks/useOrchestUserConfig";
import { useOrchestVersion } from "./hooks/useOrchestVersion";

// TODO: remove this when Orchest supports changing disk size.
const shouldShowHostInfo = false;

const SettingsView: React.FC = () => {
  const { navigateTo } = useCustomRoute();
  const {
    setAlert,
    setAsSaved,
    setConfirm,
    state: { hasUnsavedChanges },
    config: orchestConfig,
  } = useAppContext();

  const checkUpdate = useCheckUpdate();

  useSendAnalyticEvent("view load", { name: siteMap.settings.path });

  const [status, setStatus] = useOrchestStatus();

  const version = useOrchestVersion();
  const hostInfo = useHostInfo(shouldShowHostInfo);

  const {
    userConfig,
    setUserConfig,
    saveUserConfig,
    requiresRestart,
    setRequiresRestart,
    saveUserConfigError,
  } = useOrchestUserConfig(setAsSaved, orchestConfig);

  React.useEffect(() => {
    if (hasValue(saveUserConfigError))
      setAlert(
        "Error",
        `Failed to save config. ${saveUserConfigError || "Unknown reason."}`
      );
  }, [saveUserConfigError, setAlert]);

  const onClickManageUsers = (e: React.MouseEvent) => {
    navigateTo(siteMap.manageUsers.path, undefined, e);
  };

  const loadConfigureJupyterLab = (e: React.MouseEvent) => {
    navigateTo(siteMap.configureJupyterLab.path, undefined, e);
  };

  const restartOrchest = () => {
    return setConfirm(
      "Warning",
      "Are you sure you want to restart Orchest? This will kill all running Orchest containers (including kernels/pipelines).",
      async (resolve) => {
        setStatus("restarting");
        setRequiresRestart([]);

        try {
          await fetcher("/async/restart", { method: "POST" });
          resolve(true);

          setTimeout(() => {
            checkHeartbeat("/heartbeat")
              .then(() => {
                console.log("Orchest available");
                setStatus("online");
              })
              .catch((retries) => {
                console.log(
                  "Update service heartbeat checking timed out after " +
                    retries +
                    " retries."
                );
              });
          }, 5000); // allow 5 seconds for orchest-controller to stop orchest
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

  const isValidUserConfig = React.useMemo(() => {
    if (!userConfig) return true;
    try {
      JSON.parse(userConfig);
      return true;
    } catch {
      return false;
    }
  }, [userConfig]);

  return (
    <Layout>
      <div className={"view-page orchest-settings"}>
        <PageTitle>Orchest settings</PageTitle>
        <div className="push-down">
          <div>
            {userConfig === undefined ? (
              <Typography>Loading config...</Typography>
            ) : (
              <Box>
                <CodeMirror
                  value={userConfig}
                  options={{
                    mode: "application/json",
                    theme: "jupyter",
                    lineNumbers: true,
                  }}
                  onBeforeChange={(editor, data, value) => {
                    setUserConfig(value);
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
                  {!isValidUserConfig && (
                    <Alert severity="warning">
                      Your input is not valid JSON.
                    </Alert>
                  )}
                  {requiresRestart.length > 0 && (
                    <Alert severity="info">{`Restart Orchest for the changes to ${requiresRestart
                      .map((val) => `"${val}"`)
                      .join(" ")} to take effect.`}</Alert>
                  )}
                </Stack>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() => saveUserConfig()}
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
            {version ? (
              <p>{version}</p>
            ) : (
              <LinearProgress className="push-down" />
            )}
            {orchestConfig?.FLASK_ENV === "development" && (
              <p>
                <Code>development mode</Code>
              </p>
            )}
          </div>
          <div className="clear"></div>
        </div>

        {shouldShowHostInfo && (
          <>
            <div className="columns">
              <div className="column">
                <p>Disk usage.</p>
              </div>
              <div className="column">
                {hostInfo ? (
                  <>
                    <LinearProgress
                      className="disk-size-info"
                      variant="determinate"
                      value={hostInfo.disk_info.used_pcent}
                    />

                    <div className="disk-size-info push-up-half">
                      <span>{hostInfo.disk_info.used_GB + "GB used"}</span>
                      <span className="float-right">
                        {hostInfo.disk_info.avail_GB + "GB free"}
                      </span>
                    </div>
                  </>
                ) : (
                  <LinearProgress className="push-down disk-size-info" />
                )}
              </div>
            </div>
            <div className="clear"></div>
          </>
        )}

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
            {status !== "restarting" ? (
              <StyledButtonOutlined
                variant="outlined"
                color="secondary"
                startIcon={<PowerSettingsNewIcon />}
                onClick={restartOrchest}
                data-test-id="restart"
              >
                Restart
              </StyledButtonOutlined>
            ) : (
              <>
                <LinearProgress className="push-down" />
                <p>This can take up to 1 minute.</p>
              </>
            )}
            <p className="push-up">
              {`Orchest's current status is `}
              <i>{status}</i>
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
