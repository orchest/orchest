import { Overflowable } from "@/components/common/Overflowable";
import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import { ResizablePane } from "@/components/ResizablePane";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { StepState } from "@/types";
import { CloseOutlined } from "@mui/icons-material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import React from "react";
import { usePipelineCanvasDimensionsContext } from "../contexts/PipelineCanvasDimensionsContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { StepConnections } from "./StepConnections";
import { StepDetailsActions } from "./StepDetailsActions";
import { StepDetailsContextProvider } from "./StepDetailsContext";
import { StepDetailsLogs } from "./StepDetailsLogs";
import { StepDetailsProperties } from "./StepDetailsProperties";

const CustomTabPanel = styled(TabPanel)(({ theme }) => ({
  padding: theme.spacing(4, 3),
}));

const tabs = [
  {
    id: "pipeline-properties",
    label: "Properties",
  },
  {
    id: "connections",
    label: "Connections",
  },
  {
    id: "pipeline-logs",
    label: "Logs",
  },
];

type StepDetailsProps = {
  onSave: (
    stepChanges: Partial<StepState>,
    uuid: string,
    replace?: boolean
  ) => void;
  onClose: () => void;
};

const StepDetailsComponent = ({ onSave, onClose }: StepDetailsProps) => {
  const { jobUuid, projectUuid } = useCustomRoute();
  const {
    pipelineCwd,
    runUuid,
    isReadOnly,
    pipelineJson,
  } = usePipelineDataContext();
  const {
    uiState: { subViewIndex, shouldAutoFocus, stepSelector, steps, openedStep },
    uiStateDispatch,
  } = usePipelineUiStateContext();
  const { setStepDetailsPanelWidth } = usePipelineCanvasDimensionsContext();

  const onResize = React.useCallback(
    (width) => setStepDetailsPanelWidth(width),
    [setStepDetailsPanelWidth]
  );

  const step = steps[openedStep || ""];

  const onSelectSubView = (
    _: React.SyntheticEvent<Element, Event>,
    index: number
  ) => uiStateDispatch({ type: "SELECT_SUB_VIEW", payload: index });

  const shouldHideStepDetails =
    !openedStep || !step || !pipelineJson || stepSelector.active;

  const { hideIntercom, showIntercom } = useAppContext();

  React.useEffect(() => {
    if (shouldHideStepDetails) {
      showIntercom();
    } else {
      hideIntercom();
    }
  }, [shouldHideStepDetails, hideIntercom, showIntercom]);

  if (shouldHideStepDetails) return null;

  return (
    <StepDetailsContextProvider>
      <ResizablePane
        direction="horizontal"
        anchor="right"
        onSetSize={onResize}
        initialSize={420}
        minWidth={420}
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
          sx={{ padding: (theme) => theme.spacing(2, 3) }}
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
        >
          <Box flex={1}>{step.title}</Box>
          <IconButton onClick={onClose}>
            <CloseOutlined />
          </IconButton>
        </Typography>
        <Tabs
          label="pipeline-details"
          value={subViewIndex}
          onChange={onSelectSubView}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              id={tab.id}
              label={<TabLabel>{tab.label}</TabLabel>}
              aria-controls={tab.id}
              data-test-id={`${tab.id}-tab`}
            />
          ))}
        </Tabs>
        <Overflowable
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 0",
          }}
        >
          <CustomTabPanel
            value={subViewIndex}
            index={0}
            name="pipeline-details"
          >
            <StepDetailsProperties
              pipelineCwd={pipelineCwd}
              readOnly={isReadOnly}
              shouldAutoFocus={shouldAutoFocus}
              onSave={onSave}
            />
          </CustomTabPanel>
          <CustomTabPanel value={subViewIndex} index={1} name="connections">
            <StepConnections onSave={onSave} />
          </CustomTabPanel>
          <CustomTabPanel value={subViewIndex} index={2} name="pipeline-logs">
            <StepDetailsLogs
              projectUuid={projectUuid}
              jobUuid={jobUuid}
              runUuid={runUuid}
              type="step"
              pipelineUuid={pipelineJson.uuid}
            />
          </CustomTabPanel>
        </Overflowable>
        <Stack marginTop="auto">
          <StepDetailsActions />
        </Stack>
      </ResizablePane>
    </StepDetailsContextProvider>
  );
};

export const StepDetails = React.memo(StepDetailsComponent);
