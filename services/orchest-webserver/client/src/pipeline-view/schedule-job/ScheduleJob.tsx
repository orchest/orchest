import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { ScheduleJobPanel } from "./ScheduleJobPanel";
import { ScheduleJobSnackBar } from "./ScheduleJobSnackBar";

export const ScheduleJob = () => {
  const {
    uiState: { draftJob },
  } = usePipelineUiStateContext();
  return (
    <>
      {hasValue(draftJob) && <ScheduleJobPanel />}
      <ScheduleJobSnackBar />
    </>
  );
};
