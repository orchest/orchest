import { Overflowable } from "@/components/common/Overflowable";
import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Step } from "@/types";
import { CloseOutlined } from "@mui/icons-material";
import { IconButton, Stack, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import React from "react";
import {
  ClientPosition,
  useDragElementWithPosition,
} from "../../hooks/useDragElementWithPosition";
import { ResizeBar } from "../components/ResizeBar";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { StepDetailsActions } from "./StepDetailsActions";
import { StepDetailsConnections } from "./StepDetailsConnections";
import { StepDetailsContextProvider } from "./StepDetailsContext";
import { StepDetailsLogs } from "./StepDetailsLogs";
import { StepDetailsProperties } from "./StepDetailsProperties";

const CustomTabPanel = styled(TabPanel)(({ theme }) => ({
  padding: theme.spacing(4, 3),
}));

const StepDetailsContainer = styled("div")(({ theme }) => ({
  height: "100%",
  backgroundColor: theme.palette.common.white,
  borderLeft: `1px solid ${theme.palette.grey[300]}`,
  zIndex: 12,
  width: 0,
  display: "flex",
  flexDirection: "column",
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
  onSave: (stepChanges: Partial<Step>, uuid: string, replace?: boolean) => void;
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

  const step = steps[openedStep || ""];

  const [storedPanelWidth, setStoredPanelWidth] = useLocalStorage(
    "pipelinedetails.panelWidth",
    450
  );

  const [panelWidth, setPanelWidth] = React.useState(storedPanelWidth ?? 450);

  const onDragging = React.useCallback(
    (position: React.MutableRefObject<ClientPosition>) => {
      setPanelWidth((prevPanelWidth) => {
        let newPanelWidth = Math.max(
          50, // panelWidth min: 50px
          prevPanelWidth - position.current.delta.x
        );
        position.current.delta.x = 0;
        return newPanelWidth;
      });
    },
    []
  );

  const onStopDragging = React.useCallback(() => {
    setPanelWidth((panelWidth) => {
      setStoredPanelWidth(panelWidth);
      return panelWidth;
    });
  }, [setStoredPanelWidth]);

  const startDragging = useDragElementWithPosition(onDragging, onStopDragging);

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
      <StepDetailsContainer style={{ width: panelWidth + "px" }}>
        <ResizeBar onMouseDown={startDragging} />

        <Typography
          component="div"
          variant="h6"
          sx={{ padding: (theme) => theme.spacing(2, 3) }}
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
        >
          {step.title}
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
        <Overflowable sx={{ display: "flex", flexDirection: "column" }}>
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
              menuMaxWidth={`${panelWidth - 48}px`}
            />
          </CustomTabPanel>
          <CustomTabPanel value={subViewIndex} index={1} name="connections">
            <StepDetailsConnections onSave={onSave} />
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
      </StepDetailsContainer>
    </StepDetailsContextProvider>
  );
};

export const StepDetails = React.memo(StepDetailsComponent);
