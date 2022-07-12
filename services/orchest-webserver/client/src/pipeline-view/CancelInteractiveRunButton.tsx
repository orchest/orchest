import { useCustomRoute } from "@/hooks/useCustomRoute";
import CloseIcon from "@mui/icons-material/Close";
import React from "react";
import { useInteractiveRunsContext } from "./contexts/InteractiveRunsContext";
import { usePipelineEditorContext } from "./contexts/PipelineEditorContext";
import { PipelineActionButton } from "./PipelineActionButton";

export const CancelInteractiveRunButton = () => {
  const { jobUuid } = useCustomRoute();
  const {
    cancelRun,
    pipelineRunning,
    isCancellingRun,
  } = useInteractiveRunsContext();
  const { runUuid } = usePipelineEditorContext();

  return pipelineRunning ? (
    <div className="selection-buttons">
      <PipelineActionButton
        onClick={() => cancelRun({ jobUuid, runUuid })}
        startIcon={<CloseIcon />}
        disabled={isCancellingRun}
        data-test-id="interactive-run-cancel"
      >
        Cancel run
      </PipelineActionButton>
    </div>
  ) : null;
};
