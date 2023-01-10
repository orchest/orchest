import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import { Code } from "@/components/common/Code";
import { CircularProgressIcon } from "@/components/common/icons/CircularProgressIcon";
import { useAppContext } from "@/contexts/AppContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { useHostInfo } from "./hooks/useHostInfo";
import { useOrchestStatus } from "./hooks/useOrchestStatus";
import { SettingsViewLayout } from "./SettingsViewLayout";
import { UserConfig } from "./UserConfig";

export const SettingsView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.settings.path });

  const orchestConfig = useOrchestConfigsApi((state) => state.config);
  const { orchestVersion, checkUpdate } = useAppContext();
  const { status, restart } = useOrchestStatus();

  const hostInfo = useHostInfo();

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
                onClick={restart}
                onAuxClick={restart}
                sx={{ marginLeft: (theme) => theme.spacing(2) }}
              >
                Restart
              </Button>
            )}
          </Stack>
        </Stack>
        <UserConfig />
      </Stack>
    </SettingsViewLayout>
  );
};
