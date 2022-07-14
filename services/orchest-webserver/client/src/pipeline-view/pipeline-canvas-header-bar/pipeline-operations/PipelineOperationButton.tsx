import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useThrottle } from "@/hooks/useThrottle";
import { usePipelineEditorContext } from "@/pipeline-view/contexts/PipelineEditorContext";
import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import React from "react";
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
    eventVars: { steps },
  } = usePipelineEditorContext();
  const hasNoStep = Object.keys(steps).length === 0;

  const localRef = React.useRef<HTMLButtonElement>();
  const {
    pipelineRunning,
    runSelectedSteps,
    runAllSteps,
    shouldRunAll,
    cancelRun,
    isCancellingRun,
  } = useRunSteps();

  const { withThrottle, reset } = useThrottle();

  React.useEffect(() => {
    reset();
  }, [pipelineRunning, isCancellingRun, reset]);

  const disabled = pipelineIsReadOnly || hasNoStep;

  const [buttonLabel, executeOperation] = React.useMemo(() => {
    if (pipelineRunning) return ["Cancel run", cancelRun];
    if (isCancellingRun) return ["Cancelling...", undefined];
    if (shouldRunAll) return ["Run all", runAllSteps];
    return ["Run selected", runSelectedSteps];
  }, [
    cancelRun,
    isCancellingRun,
    pipelineRunning,
    runAllSteps,
    runSelectedSteps,
    shouldRunAll,
  ]);

  // Prevent the unintentional second click.
  const handleClick = executeOperation
    ? withThrottle(executeOperation)
    : undefined;

  const icon = isCancellingRun ? (
    <CircularProgress size={20} />
  ) : pipelineRunning ? (
    <StopCircleOutlinedIcon fontSize="small" />
  ) : (
    <PlayCircleOutlineOutlinedIcon fontSize="small" />
  );

  return (
    <Button
      variant="contained"
      color={pipelineRunning ? "secondary" : "primary"}
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
            pipelineRunning
              ? theme.palette.secondary.main
              : theme.palette.primary.main,
        },
      }}
      startIcon={icon}
      endIcon={
        pipelineRunning ? null : (
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
            pipelineRunning ? theme.spacing(16.5) : theme.spacing(13.5),
        }}
      >
        {buttonLabel}
      </Box>
    </Button>
  );
});
