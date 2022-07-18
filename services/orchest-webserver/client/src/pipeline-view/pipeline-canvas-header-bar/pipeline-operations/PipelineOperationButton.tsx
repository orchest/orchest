import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useThrottle } from "@/hooks/useThrottle";
import { usePipelineUiStateContext } from "@/pipeline-view/contexts/PipelineUiStateContext";
import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import React from "react";
import { PipelineOperationButtonIcon } from "./PipelineOperationButtonIcon";
import { useRunSteps } from "./useRunSteps";

type PipelineOperationButtonProps = { openMenu: (e: React.MouseEvent) => void };

export const PipelineOperationButton = React.forwardRef<
  HTMLButtonElement,
  PipelineOperationButtonProps
>(function PipelineOperationButtonComponent({ openMenu }, ref) {
  const {
    state: { pipelineIsReadOnly },
  } = useProjectsContext();
  const {
    uiState: { steps },
  } = usePipelineUiStateContext();
  const hasNoStep = Object.keys(steps).length === 0;

  const localRef = React.useRef<HTMLButtonElement>();
  const {
    displayedPipelineStatus,
    runSelectedSteps,
    runAllSteps,
    shouldRunAll,
    cancelRun,
  } = useRunSteps();

  const { withThrottle, reset } = useThrottle();

  React.useEffect(() => {
    reset();
  }, [displayedPipelineStatus, reset]);

  const disabled = pipelineIsReadOnly || hasNoStep;

  const [buttonLabel, executeOperation] = React.useMemo(() => {
    if (displayedPipelineStatus === "RUNNING") return ["Cancel run", cancelRun];
    if (displayedPipelineStatus === "CANCELING")
      return ["Cancelling...", undefined];
    if (shouldRunAll) return ["Run all", runAllSteps];
    return ["Run selected", runSelectedSteps];
  }, [
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

  return (
    <Button
      variant="contained"
      disableRipple
      color={displayedPipelineStatus === "IDLING" ? "primary" : "secondary"}
      ref={(node: HTMLButtonElement) => {
        localRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      disabled={disabled}
      sx={{
        marginLeft: (theme) => theme.spacing(1),
        ":hover": {
          backgroundColor: (theme) =>
            displayedPipelineStatus === "IDLING"
              ? theme.palette.primary.main
              : theme.palette.secondary.main,
        },
      }}
      startIcon={
        <PipelineOperationButtonIcon status={displayedPipelineStatus} />
      }
      endIcon={
        displayedPipelineStatus !== "IDLING" ? null : (
          <Box
            sx={{
              margin: (theme) => theme.spacing(-2, -1.5, -2, 0),
              width: (theme) => theme.spacing(4),
              backgroundColor: (theme) =>
                !disabled
                  ? theme.palette.primary.dark
                  : theme.palette.action.disabledBackground,
            }}
            onClick={!disabled ? openMenu : undefined}
          >
            <ArrowDropDownOutlinedIcon
              fontSize="small"
              sx={{
                transform: (theme) => `translate(0, ${theme.spacing(0.5)})`,
              }}
            />
          </Box>
        )
      }
      onClick={handleClick}
    >
      <Box
        sx={{
          marginRight: (theme) => theme.spacing(1),
          minWidth: (theme) =>
            displayedPipelineStatus !== "IDLING" ? theme.spacing(14) : "unset",
        }}
      >
        {buttonLabel}
      </Box>
    </Button>
  );
});
