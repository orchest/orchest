import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import { Code } from "@/components/common/Code";
import { CircularProgressIcon } from "@/components/common/icons/CircularProgressIcon";
import { useAppContext } from "@/contexts/AppContext";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useHasChanged } from "@/hooks/useHasChanged";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import SaveIcon from "@mui/icons-material/Save";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { checkHeartbeat, fetcher, hasValue } from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { useHostInfo } from "./hooks/useHostInfo";
import { useOrchestStatus } from "./hooks/useOrchestStatus";
import { useOrchestUserConfig } from "./hooks/useOrchestUserConfig";
import { SettingsViewLayout } from "./SettingsViewLayout";

export const SettingsView = () => {
  const {
    setAlert,
    setAsSaved,
    setConfirm,
    state: { hasUnsavedChanges },
  } = useGlobalContext();

  const orchestConfig = useOrchestConfigsApi((state) => state.config);

  const { orchestVersion, checkUpdate } = useAppContext();

  useSendAnalyticEvent("view:loaded", { name: siteMap.settings.path });

  const [status, setStatus] = useOrchestStatus();

  const hasRestarted = useHasChanged(
    status,
    (prev, curr) => prev === "restarting" && curr === "online"
  );

  React.useEffect(() => {
    if (hasRestarted) window.location.reload();
  }, [hasRestarted]);

  const hostInfo = useHostInfo();

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

  const restartOrchest = () => {
    return setConfirm(
      "Warning",
      "Are you sure you want to restart Orchest? This will terminate all running Orchest containers (including kernels/pipelines).",
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

  // Assuming any 2TB+ available GB indication to be
  // unreliable. This is mainly due to unconstrained
  // storage systems like EFS that report a fictitious
  // upper bound of the storage.
  const isDiskUsageReliable = hostInfo
    ? hostInfo.disk_info.avail_GB < 2000
    : false;
  return (
    <SettingsViewLayout header={<Typography variant="h5">General</Typography>}>
      <Stack direction="column" spacing={3}>
        <Stack direction="column" alignItems="flex-start" spacing={1}>
          <Typography variant="h6">Version</Typography>
          <Stack direction="row" alignItems="center" spacing={2}>
            {orchestVersion && (
              <Code sx={{ marginBottom: 0 }}>{orchestVersion}</Code>
            )}
            {orchestConfig?.FLASK_ENV === "development" && (
              <Code>development mode</Code>
            )}
            <Button
              variant="text"
              onClick={checkUpdate}
              onAuxClick={checkUpdate}
              sx={{ marginLeft: (theme) => theme.spacing(2) }}
            >
              Check for update
            </Button>
          </Stack>
        </Stack>
        {hostInfo && isDiskUsageReliable && (
          <Stack
            direction="column"
            alignItems="flex-start"
            spacing={1}
            sx={{ width: "100%" }}
          >
            <Typography variant="h6">Disk volume</Typography>
            <Stack
              direction="row"
              alignItems="center"
              spacing={2}
              sx={{ width: "100%", maxWidth: (theme) => theme.spacing(80) }}
            >
              <LinearProgress
                variant="determinate"
                value={hostInfo.disk_info.used_pcent}
                sx={{ height: 4, width: "100%" }}
              />
              <Typography
                variant="caption"
                sx={{
                  whiteSpace: "nowrap",
                  color: (theme) => theme.palette.action.active,
                }}
              >
                {`${hostInfo.disk_info.used_GB} / ${hostInfo.disk_info.avail_GB} GB`}
              </Typography>
            </Stack>
          </Stack>
        )}
        <Stack direction="column" alignItems="flex-start" spacing={1}>
          <Typography variant="h6">Orchest status</Typography>
          <Stack direction="row" spacing={2}>
            <Chip
              label={status}
              icon={
                status === "restarting" ? (
                  <CircularProgressIcon fontSize="medium" />
                ) : undefined
              }
              color={status === "online" ? "success" : "default"}
              sx={{ textTransform: "capitalize" }}
              variant="outlined"
            />
            {status !== "restarting" && (
              <Button
                variant="text"
                onClick={restartOrchest}
                onAuxClick={restartOrchest}
                sx={{ marginLeft: (theme) => theme.spacing(2) }}
              >
                Restart
              </Button>
            )}
          </Stack>
        </Stack>
        <Stack direction="column" alignItems="flex-start" spacing={1}>
          <Typography variant="h6">Custom configuration</Typography>
          <CodeMirror
            value={userConfig || ""}
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
            direction="row"
            spacing={3}
            sx={{
              marginTop: (theme) => theme.spacing(1),
              marginBottom: (theme) => theme.spacing(1),
            }}
          >
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={!isValidUserConfig}
              onClick={() => saveUserConfig()}
            >
              {hasUnsavedChanges ? "SAVE*" : "SAVE"}
            </Button>
            {!isValidUserConfig && (
              <Alert severity="warning">Your input is not valid JSON.</Alert>
            )}
            {requiresRestart.length > 0 && (
              <Alert severity="info">{`Restart Orchest for the changes to ${requiresRestart
                .map((val) => `"${val}"`)
                .join(" ")} to take effect.`}</Alert>
            )}
          </Stack>
        </Stack>
      </Stack>
    </SettingsViewLayout>
  );
};
