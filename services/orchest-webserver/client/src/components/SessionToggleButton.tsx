import { BUILD_IMAGE_SOLUTION_VIEW } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { OrchestSession } from "@/types";
import { Box, CircularProgress, Stack, Tooltip } from "@mui/material";
import { blue, grey } from "@mui/material/colors";
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

  const statusLabel =
    {
      LAUNCHING: "Starting session…",
      STOPPING: "Stopping session…",
      RUNNING: "Stop session",
    }[status] || "Start session";

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

  const title = isRunning ? "Stop session" : "Start session";

  return (
    <FormControlLabel
      disableTypography
      control={
        <Switch
          disabled={isStopping}
          size="small"
          title={title}
          inputProps={{ "aria-label": title }}
          sx={{ margin: (theme) => theme.spacing(0, 1) }}
          className={className}
          checked={isRunning || isStarting}
          onChange={onChange}
        />
      }
      label={
        <Tooltip title={statusLabel} placement="right-end">
          <Stack direction="row" justifyContent="center">
            {label}{" "}
            <Box
              sx={{
                opacity: isStarting || isStopping ? 1 : 0,
                transition: "opacity 250ms ease-in",
              }}
            >
              <CircularProgress
                size={18}
                variant="indeterminate"
                sx={{
                  marginLeft: 1.5,
                  svg: { color: isStopping ? grey[500] : blue[500] },
                }}
              />
            </Box>
          </Stack>
        </Tooltip>
      }
      sx={sx}
    />
  );
};
