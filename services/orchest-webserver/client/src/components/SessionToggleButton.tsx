import { BUILD_IMAGE_SOLUTION_VIEW } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { OrchestSession } from "@/types";
import { Box, CircularProgress, Stack, Tooltip } from "@mui/material";
import FormControlLabel from "@mui/material/FormControlLabel";
import { SxProps, Theme } from "@mui/material/styles";
import Switch from "@mui/material/Switch";
import React from "react";

export type SessionToggleButtonRef = HTMLButtonElement;

type SessionToggleButtonProps = {
  status?: OrchestSession["status"] | "";
  pipelineUuid: string;
  label?: React.ReactElement | string | number;
  className?: string;
  sx?: SxProps<Theme>;
};

export const SessionToggleButton = ({
  className,
  label,
  pipelineUuid,
  sx,
  ...props
}: SessionToggleButtonProps) => {
  const { getSession, startSession, stopSession } = useSessionsContext();

  const session = getSession(pipelineUuid);
  const status = props.status || session?.status || "";

  const isStarting = status === "LAUNCHING";
  const isStopping = status === "STOPPING";
  const isRunning = status === "RUNNING";

  const title = isRunning ? "Stop session" : "Start session";
  const statusLabel = {
    LAUNCHING: "Starting session…",
    STOPPING: "Stopping session…",
    RUNNING: "Stop session",
  }[status];

  const onChange = (
    _: React.MouseEvent | React.ChangeEvent,
    checked: boolean
  ) => {
    if (checked) {
      startSession(pipelineUuid, BUILD_IMAGE_SOLUTION_VIEW.PIPELINE);
    } else if (!checked && (isStarting || isRunning)) {
      stopSession(pipelineUuid);
    }
  };

  return (
    <FormControlLabel
      disableTypography
      control={
        <Tooltip title={statusLabel ?? "Start session"}>
          <span>
            <Switch
              disabled={isStopping}
              size="small"
              inputProps={{ "aria-label": title }}
              sx={{ margin: (theme) => theme.spacing(0, 1) }}
              className={className}
              checked={isRunning || isStarting}
              onChange={onChange}
            />
          </span>
        </Tooltip>
      }
      label={
        <Stack direction="row" justifyContent="center">
          {label}
          <Tooltip
            title={statusLabel ?? ""}
            placement="right-end"
            hidden={!status || status === "RUNNING"}
          >
            <Box
              sx={{
                opacity: !status || status === "RUNNING" ? 0 : 1,
                transition: "opacity 250ms ease-in",
              }}
            >
              <CircularProgress
                size={18}
                variant="indeterminate"
                sx={{ marginLeft: 1.5 }}
              />
            </Box>
          </Tooltip>
        </Stack>
      }
      sx={sx}
    />
  );
};
