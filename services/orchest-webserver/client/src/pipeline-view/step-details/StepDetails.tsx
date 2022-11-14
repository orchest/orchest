import { Overflowable } from "@/components/common/Overflowable";
import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import {
  MIN_SECONDARY_SIDE_PANEL_WIDTH,
  useSecondarySidePanelWidth,
} from "@/components/layout/stores/useLayoutStore";
import { ResizablePane } from "@/components/ResizablePane";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHideIntercom } from "@/hooks/useHideIntercom";
import { StepState } from "@/types";
import { CloseOutlined } from "@mui/icons-material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { StepConnections } from "./StepConnections";
import { StepDetailsActions } from "./StepDetailsActions";
import { StepDetailsContextProvider } from "./StepDetailsContext";
import { StepDetailsLogs } from "./StepDetailsLogs";
import { StepProperties } from "./StepProperties";

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
    uiState: { subViewIndex, stepSelector, steps, openedStep },
    uiStateDispatch,
  } = usePipelineUiStateContext();

  const [
    stepDetailsPanelWidth,
    setStepDetailsPanelWidth,
  ] = useSecondarySidePanelWidth();

  const step = steps[openedStep || ""];

  const stepNameInputRef = React.useRef<HTMLInputElement>();

  const onSelectSubView = (
    _: React.SyntheticEvent<Element, Event>,
    index: number
  ) => uiStateDispatch({ type: "SELECT_SUB_VIEW", payload: index });

  const shouldHideStepDetails =
    !openedStep || !step || !pipelineJson || stepSelector.active;

  const shouldHideIntercom = !shouldHideStepDetails;
  useHideIntercom(shouldHideIntercom);

  if (shouldHideStepDetails) return null;

  return (
    <StepDetailsContextProvider>
      <ResizablePane
        direction="horizontal"
        anchor="right"
        onSetSize={setStepDetailsPanelWidth}
        initialSize={stepDetailsPanelWidth}
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
          sx={{ padding: (theme) => theme.spacing(2, 1, 1, 3) }}
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
        >
          <Box
            flex={1}
            sx={{
              color: (theme) =>
                step.title ? "inherent" : theme.palette.action.active,
            }}
            onClick={() => {
              if (!step.title && stepNameInputRef.current) {
                stepNameInputRef.current.focus();
              }
            }}
          >
            {step.title || "(Unnamed Step)"}
          </Box>
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
            <StepProperties
              pipelineCwd={pipelineCwd}
              readOnly={isReadOnly}
              onSave={onSave}
              stepInputRef={stepNameInputRef}
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
