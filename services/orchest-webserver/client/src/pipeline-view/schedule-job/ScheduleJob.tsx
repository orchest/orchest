import { useHideIntercom } from "@/hooks/useHideIntercom";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { ScheduleJobPanel } from "./ScheduleJobPanel";
import { ScheduleJobSnackBar } from "./ScheduleJobSnackBar";

export const ScheduleJob = () => {
  const {
    uiState: { draftJob },
  } = usePipelineUiStateContext();
  const isPanelOpen = hasValue(draftJob);
  // Disable auto-show.
  // Snackbar will appear right after closing the panel.
  // Intercom should stay hidden.
  useHideIntercom(isPanelOpen, false);

  return (
    <>
      {isPanelOpen && <ScheduleJobPanel />}
      <ScheduleJobSnackBar />
    </>
  );
};
