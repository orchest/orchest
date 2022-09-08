import { Overflowable } from "@/components/common/Overflowable";
import {
  MAX_WIDTH,
  MIN_SECONDARY_SIDE_PANEL_WIDTH,
  useSecondarySidePanelWidth,
} from "@/components/Layout/layout-with-side-panel/stores/useLayoutStore";
import { ResizablePane } from "@/components/ResizablePane";
import { CloseOutlined } from "@mui/icons-material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { usePipelineUiState } from "../hooks/usePipelineUiState";
import { ScheduleJobActions } from "./ScheduleJobActions";

export const ScheduleJobPanel = () => {
  const [panelWidth, setPanelWidth] = useSecondarySidePanelWidth();
  const {
    uiState: { draftJob },
    uiStateDispatch,
  } = usePipelineUiState();
  const onClose = () => {
    uiStateDispatch({ type: "SET_DRAFT_JOB", payload: undefined });
  };

  if (!draftJob) return null;

  return (
    <ResizablePane
      direction="horizontal"
      anchor="right"
      onSetSize={setPanelWidth}
      initialSize={panelWidth}
      minWidth={MIN_SECONDARY_SIDE_PANEL_WIDTH}
      maxWidth={MAX_WIDTH}
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
        sx={{ padding: (theme) => theme.spacing(2, 3) }}
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
      >
        <Box flex={1}>Schedule Job</Box>
        <IconButton onClick={onClose}>
          <CloseOutlined />
        </IconButton>
      </Typography>
      <Overflowable
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: "1 1 0",
        }}
      >
        {
          // JobView
        }
      </Overflowable>
      <Stack marginTop="auto">
        <ScheduleJobActions />
      </Stack>
    </ResizablePane>
  );
};
