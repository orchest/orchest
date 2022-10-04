import { BUILD_IMAGE_SOLUTION_VIEW } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { OrchestSession } from "@/types";
import FormControlLabel from "@mui/material/FormControlLabel";
import { SxProps, Theme } from "@mui/material/styles";
import Switch from "@mui/material/Switch";
import React from "react";

export type TSessionToggleButtonRef = HTMLButtonElement;
type ISessionToggleButtonProps = {
  status?: OrchestSession["status"] | "";
  pipelineUuid: string;
  label?: React.ReactElement | string | number;
  className?: string;
  sx?: SxProps<Theme>;
};

const SessionToggleButton = (props: ISessionToggleButtonProps) => {
  const { getSession, startSession, stopSession } = useSessionsContext();

  const { className, label, pipelineUuid, sx } = props;

  const session = getSession(pipelineUuid);
  const status = props.status || session?.status || "";

  const isLaunching = status === "LAUNCHING";
  const isStopping = status === "STOPPING";
  const isRunning = status === "RUNNING";

  const statusLabel =
    {
      STOPPING: "Session stopping…",
      LAUNCHING: "Session starting…",
      RUNNING: "Stop session",
    }[status] || "Start session";

  const onChange = (
    _: React.MouseEvent | React.ChangeEvent,
    checked: boolean
  ) => {
    const shouldStart = checked || !session;

    if (shouldStart) {
      startSession(pipelineUuid, BUILD_IMAGE_SOLUTION_VIEW.PIPELINE);
    } else {
      stopSession(pipelineUuid);
    }
  };

  return (
    <FormControlLabel
      disableTypography
      labelPlacement="start"
      control={
        <Switch
          classes={{ root: isLaunching ? "launching" : "" }}
          disabled={isLaunching || isStopping}
          size="small"
          inputProps={{
            "aria-label": `Switch ${isRunning ? "off" : "on"} session`,
          }}
          sx={{ margin: (theme) => theme.spacing(0, 1) }}
          className={className}
          checked={isRunning || isLaunching}
          onChange={onChange}
        />
      }
      label={label || statusLabel}
      sx={sx}
    />
  );
};

export default SessionToggleButton;
