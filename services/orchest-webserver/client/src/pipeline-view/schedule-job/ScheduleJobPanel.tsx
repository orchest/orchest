import { Overflowable } from "@/components/common/Overflowable";
import {
  MIN_SECONDARY_SIDE_PANEL_WIDTH,
  useSecondarySidePanelWidth,
} from "@/components/layout/stores/useLayoutStore";
import { ResizablePane } from "@/components/ResizablePane";
import { useSaveJobChanges } from "@/jobs-view/hooks/useSaveJobChanges";
import { EditJobProperties } from "@/jobs-view/job-view/EditJobProperties";
import { JobEnvVariables } from "@/jobs-view/job-view/JobEnvVariables";
import { JobParameters } from "@/jobs-view/job-view/JobParameters";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { CloseOutlined } from "@mui/icons-material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { ScheduleJobActions } from "./ScheduleJobActions";
import { useScheduleJobSnackBarMessage } from "./ScheduleJobSnackBar";

export const ScheduleJobPanel = () => {
  const [panelWidth, setPanelWidth] = useSecondarySidePanelWidth();

  const { uiStateDispatch } = usePipelineUiStateContext();

  const setSnackBarMessage = useScheduleJobSnackBarMessage(
    (state) => state.setMessage
  );

  const jobName = useEditJob((state) => state.jobChanges?.name);

  const onClosePanel = React.useCallback(() => {
    uiStateDispatch({ type: "SET_DRAFT_JOB", payload: undefined });
    setSnackBarMessage(`Draft "${jobName}" has been saved in Jobs`);
  }, [uiStateDispatch, setSnackBarMessage, jobName]);

  useSaveJobChanges();

  return (
    <ResizablePane
      direction="horizontal"
      anchor="right"
      onSetSize={setPanelWidth}
      initialSize={panelWidth}
      minWidth={MIN_SECONDARY_SIDE_PANEL_WIDTH}
      maxWidth={window.innerWidth / 2}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: (theme) => theme.palette.common.white,
        borderLeft: (theme) => `1px solid ${theme.palette.grey[300]}`,
      }}
    >
      <Typography
        component="div"
        variant="h6"
        sx={{ padding: (theme) => theme.spacing(2, 1, 2, 3) }}
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
      >
        <Box flex={1}>Schedule Job</Box>
        <IconButton onClick={onClosePanel}>
          <CloseOutlined />
        </IconButton>
      </Typography>
      <Overflowable
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: "1 1 0",
        }}
        style={{ maxWidth: panelWidth, width: panelWidth }}
      >
        <Box
          sx={{
            padding: (theme) => theme.spacing(0, 3, 3, 3),
            marginTop: (theme) => theme.spacing(-2),
          }}
        >
          <EditJobProperties hideSelectPipeline />
          <JobParameters />
          <JobEnvVariables />
        </Box>
      </Overflowable>
      <Stack marginTop="auto">
        <ScheduleJobActions />
      </Stack>
    </ResizablePane>
  );
};
