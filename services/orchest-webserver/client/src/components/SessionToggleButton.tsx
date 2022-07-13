import { BUILD_IMAGE_SOLUTION_VIEW } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import StyledButtonOutlined from "@/styled-components/StyledButton";
import { OrchestSession } from "@/types";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import { SxProps, Theme } from "@mui/material";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import classNames from "classnames";
import React from "react";

export type TSessionToggleButtonRef = HTMLButtonElement;
type ISessionToggleButtonProps = {
  status?: OrchestSession["status"] | "";
  pipelineUuid: string;
  isSwitch?: boolean;
  label?: React.ReactElement | string | number;
  className?: string;
  sx?: SxProps<Theme>;
};

const SessionToggleButton = (props: ISessionToggleButtonProps) => {
  const { getSession, startSession, stopSession } = useSessionsContext();

  const { className, isSwitch, label, pipelineUuid, sx } = props;

  const session = getSession(pipelineUuid);
  const status = props.status || session?.status || "";

  const disabled = ["STOPPING", "LAUNCHING"].includes(status);
  const statusLabel =
    {
      STOPPING: "Session stopping…",
      LAUNCHING: "Session starting…",
      RUNNING: "Stop session",
    }[status] || "Start session";

  const handleEvent = (
    e: React.MouseEvent | React.ChangeEvent,
    checked?: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const shouldStart = checked === true || !session;
    if (shouldStart) {
      startSession(pipelineUuid, BUILD_IMAGE_SOLUTION_VIEW.PIPELINE);
    } else {
      stopSession(pipelineUuid);
    }
  };
  const isSessionAlive = status === "RUNNING";

  return (
    <>
      {isSwitch ? (
        <FormControlLabel
          disableTypography
          control={
            <Switch
              disabled={disabled}
              size="small"
              inputProps={{
                "aria-label": `Switch ${isSessionAlive ? "off" : "on"} session`,
              }}
              sx={{ margin: (theme) => theme.spacing(0, 1) }}
              className={className}
              checked={isSessionAlive}
              onChange={handleEvent}
            />
          }
          label={label || statusLabel}
          sx={sx}
        />
      ) : (
        <StyledButtonOutlined
          variant="outlined"
          color="secondary"
          disabled={disabled}
          onClick={handleEvent}
          onAuxClick={(e) => {
            // middle click on this button shouldn't open new tab
            e.stopPropagation();
            e.preventDefault();
          }}
          className={classNames(
            className,
            ["LAUNCHING", "STOPPING"].includes(status) ? "working" : "active"
          )}
          startIcon={isSessionAlive ? <StopIcon /> : <PlayArrowIcon />}
          data-test-id="session-toggle-button"
          sx={sx}
        >
          {label || statusLabel}
        </StyledButtonOutlined>
      )}
    </>
  );
};

export default SessionToggleButton;
