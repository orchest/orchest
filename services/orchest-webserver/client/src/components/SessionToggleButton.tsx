import { BUILD_IMAGE_SOLUTION_VIEW } from "@/components/BuildPendingDialog";
import { useSessionsContext } from "@/contexts/SessionsContext";
import StyledButtonOutlined from "@/styled-components/StyledButton";
import { IOrchestSession } from "@/types";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import { SxProps, Theme } from "@mui/material";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import classNames from "classnames";
import React from "react";

export type TSessionToggleButtonRef = HTMLButtonElement;
type ISessionToggleButtonProps = {
  status?: IOrchestSession["status"] | "";
  pipelineUuid: string;
  projectUuid: string;
  isSwitch?: boolean;
  label?: React.ReactElement | string | number;
  className?: string;
  sx?: SxProps<Theme>;
};

const SessionToggleButton = (props: ISessionToggleButtonProps) => {
  const { state, getSession, toggleSession } = useSessionsContext();

  const { className, isSwitch, label, pipelineUuid, projectUuid, sx } = props;

  const status =
    props.status ||
    getSession({
      pipelineUuid,
      projectUuid,
    })?.status ||
    "";

  const disabled =
    state.sessionsIsLoading || ["STOPPING", "LAUNCHING"].includes(status);
  const statusLabel =
    {
      STOPPING: "Session stopping…",
      LAUNCHING: "Session starting…",
      RUNNING: "Stop session",
    }[status] || "Start session";

  const handleEvent = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSession({
      pipelineUuid,
      projectUuid,
      requestedFromView: BUILD_IMAGE_SOLUTION_VIEW.PIPELINE,
    });
  };
  const isSessionAlive = status === "RUNNING";

  return (
    <>
      {isSwitch ? (
        <FormControlLabel
          onClick={handleEvent}
          onAuxClick={(e) => {
            // middle click on this button shouldn't open new tab
            e.stopPropagation();
            e.preventDefault();
          }}
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
