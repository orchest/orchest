import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useThrottle } from "@/hooks/useThrottle";
import { usePipelineUiStateContext } from "@/pipeline-view/contexts/PipelineUiStateContext";
import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import React from "react";
import { PrimaryPipelineActionIcon } from "./PipelineOperationButtonIcon";
import { PrimaryPipelineActionMenu } from "./PrimaryPipelineActionMenu";
import { useRunSteps } from "./useRunSteps";

export const PrimaryPipelineButton = () => {
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
    displayedPipelineStatus,
    runSelectedSteps,
    runAllSteps,
    shouldRunAll,
    cancelRun,
  } = useRunSteps();

  const { withThrottle, reset } = useThrottle();

  const [buttonLabel, executeOperation] = React.useMemo(() => {
    if (pipelineReadOnlyReason) {
      return ["Run all", undefined];
    } else if (displayedPipelineStatus === "RUNNING") {
      return ["Cancel run", cancelRun];
    } else if (displayedPipelineStatus === "CANCELING") {
      return ["Cancelling...", undefined];
    } else if (shouldRunAll) {
      return ["Run all", runAllSteps];
    } else {
      return ["Run selected", runSelectedSteps];
    }
  }, [
    pipelineReadOnlyReason,
    cancelRun,
    displayedPipelineStatus,
    runAllSteps,
    runSelectedSteps,
    shouldRunAll,
  ]);

  // Prevent the unintentional second click.
  const handleClick = executeOperation
    ? withThrottle(executeOperation)
    : undefined;

  React.useEffect(() => reset(), [displayedPipelineStatus, reset]);

  const disabled = Boolean(pipelineReadOnlyReason) || hasNoStep;
  const isIdling = displayedPipelineStatus === "IDLING";
  const isRunning = displayedPipelineStatus === "RUNNING";

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
          startIcon={
            <PrimaryPipelineActionIcon status={displayedPipelineStatus} />
          }
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
