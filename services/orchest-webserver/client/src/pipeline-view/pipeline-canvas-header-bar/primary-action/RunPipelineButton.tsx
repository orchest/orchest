import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useThrottle } from "@/hooks/useThrottle";
import { usePipelineUiStateContext } from "@/pipeline-view/contexts/PipelineUiStateContext";
import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import React from "react";
import { PrimaryPipelineActionIcon } from "./PipelineOperationButtonIcon";
import { PrimaryPipelineActionMenu } from "./PrimaryPipelineActionMenu";
import { usePipelineActions } from "./usePipelineActions";

export const RunPipelineButton = () => {
  const {
    state: { pipelineReadOnlyReason },
  } = useProjectsContext();
  const {
    uiState: { steps },
  } = usePipelineUiStateContext();
  const hasNoStep = Object.keys(steps).length === 0;
  const buttonRef = React.useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = React.useState<Element>();
  const openMenu = () => setAnchor(buttonRef.current ?? undefined);
  const closeMenu = () => setAnchor(undefined);

  const {
    displayStatus,
    runSelectedSteps,
    runAllSteps,
    shouldRunAll,
    cancelRun,
  } = usePipelineActions();

  const { withThrottle, reset } = useThrottle();

  const [buttonLabel, executeOperation] = React.useMemo(() => {
    if (pipelineReadOnlyReason) {
      return ["Run all", undefined];
    } else if (displayStatus === "RUNNING") {
      return ["Cancel run", cancelRun];
    } else if (displayStatus === "CANCELING") {
      return ["Cancelling...", undefined];
    } else if (shouldRunAll) {
      return ["Run all", runAllSteps];
    } else {
      return ["Run selected", runSelectedSteps];
    }
  }, [
    pipelineReadOnlyReason,
    cancelRun,
    displayStatus,
    runAllSteps,
    runSelectedSteps,
    shouldRunAll,
  ]);

  // Prevent the unintentional second click.
  const handleClick = executeOperation
    ? withThrottle(executeOperation)
    : undefined;

  React.useEffect(() => reset(), [displayStatus, reset]);

  const disabled = Boolean(pipelineReadOnlyReason) || hasNoStep;
  const isIdling = displayStatus === "IDLING";
  const isRunning = displayStatus === "RUNNING";

  return (
    <>
      <ButtonGroup
        ref={buttonRef}
        disabled={disabled}
        variant={isRunning ? "outlined" : "contained"}
        color="primary"
        size="small"
      >
        <Button
          startIcon={<PrimaryPipelineActionIcon status={displayStatus} />}
          onClick={handleClick}
        >
          {buttonLabel}
        </Button>
        {isIdling ? (
          <Button
            sx={{ backgroundColor: (theme) => theme.palette.primary.dark }}
            size="small"
            onClick={openMenu}
          >
            <ArrowDropDownOutlinedIcon fontSize="small" />
          </Button>
        ) : null}
      </ButtonGroup>
      <PrimaryPipelineActionMenu anchor={anchor} onClose={closeMenu} />
    </>
  );
};
