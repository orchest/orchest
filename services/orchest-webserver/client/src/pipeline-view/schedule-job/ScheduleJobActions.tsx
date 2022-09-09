import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useScheduleJob } from "@/jobs-view/hooks/useScheduleJob";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { siteMap } from "@/routingConfig";
import { ellipsis } from "@/utils/styles";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import React from "react";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { useScheduleJobSnackBarMessage } from "./ScheduleJobSnackBar";

export const ScheduleJobActions = () => {
  const { navigateTo, projectUuid } = useCustomRoute();
  const { uiStateDispatch } = usePipelineUiStateContext();
  const scheduleJob = useScheduleJob();
  const jobUuid = useEditJob((state) => state.jobChanges?.uuid);
  const jobName = useEditJob((state) => state.jobChanges?.name);

  const setMessage = useScheduleJobSnackBarMessage((state) => state.setMessage);

  const editInJobs = async () => {
    navigateTo(siteMap.jobs.path, {
      query: { projectUuid, jobUuid },
    });
  };

  const scheduleJobAndClosePanel = () => {
    scheduleJob();
    setMessage(`Job "${jobName}" has been scheduled.`);
    uiStateDispatch({ type: "SET_DRAFT_JOB", payload: undefined });
  };

  return (
    <Box
      sx={{
        padding: (theme) => theme.spacing(1, 2),
        borderTop: (theme) => `1px solid ${theme.borderColor}`,
      }}
    >
      <Stack direction="row" justifyContent="space-between">
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            color="secondary"
            disabled={!jobUuid}
            onClick={editInJobs}
            onAuxClick={editInJobs}
            sx={{ ...ellipsis(), flex: "1 1 auto", display: "flex" }}
          >
            Edit in Jobs
          </Button>
          <Button
            variant="contained"
            disabled={!jobUuid}
            onClick={scheduleJobAndClosePanel}
            onAuxClick={scheduleJobAndClosePanel}
          >
            Schedule Job
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
