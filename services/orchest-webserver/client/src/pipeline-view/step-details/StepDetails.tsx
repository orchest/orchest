import { Overflowable } from "@/components/common/Overflowable";
import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import { useCheckFileValidity } from "@/hooks/useCheckFileValidity";
import { useDragElement } from "@/hooks/useDragElement";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Step } from "@/types";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import LaunchIcon from "@mui/icons-material/Launch";
import TuneIcon from "@mui/icons-material/Tune";
import ViewHeadlineIcon from "@mui/icons-material/ViewHeadline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { StepDetailsLogs } from "./StepDetailsLogs";
import { ConnectionDict, StepDetailsProperties } from "./StepDetailsProperties";

const CustomTabPanel = styled(TabPanel)(({ theme }) => ({
  padding: theme.spacing(4, 3),
}));

const ResizeBar = styled("div")(({ theme }) => ({
  position: "absolute",
  top: 0,
  height: "100%",
  width: theme.spacing(1),
  marginLeft: theme.spacing(-0.5),
  userSelect: "none",
  cursor: "col-resize",
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

const StepDetailsComponent: React.FC<{
  onOpenNotebook: (e: React.MouseEvent) => void;
  onOpenFilePreviewView: (e: React.MouseEvent, uuid: string) => void;
  onDelete: () => void;
  onSave: (stepChanges: Partial<Step>, uuid: string, replace: boolean) => void;
}> = ({ onOpenNotebook, onOpenFilePreviewView, onSave, onDelete }) => {
  const {
    eventVars,
    pipelineCwd,
    isReadOnly,
    runUuid,
    pipelineJson,
    pipelineUuid,
    dispatch,
    sio,
    jobUuid,
    projectUuid,
  } = usePipelineEditorContext();

  const step = eventVars.steps[eventVars.openedStep];

  const connections = React.useMemo(() => {
    if (!step) return {};

    const { incoming_connections = [] } = step;

    return incoming_connections.reduce((all, id: string) => {
      const { title, file_path } = eventVars.steps[id];
      return { ...all, [id]: { title, file_path } };
    }, {} as ConnectionDict);
  }, [eventVars.steps, step]);

  const [storedPanelWidth, setStoredPanelWidth] = useLocalStorage(
    "pipelinedetails.panelWidth",
    450
  );

  const uiVars = React.useRef({
    prevClientX: 0,
    cumulativeDeltaX: 0,
  });

  const onClose = () => {
    dispatch({ type: "SET_OPENED_STEP", payload: undefined });
  };

  const [panelWidth, setPanelWidth] = React.useState(storedPanelWidth);

  const [subViewIndex, setSubViewIndex] = React.useState(0);

  const onStartDragging = React.useCallback((e: React.MouseEvent) => {
    uiVars.current.prevClientX = e.clientX;
    uiVars.current.cumulativeDeltaX = 0;
  }, []);

  const onDragging = React.useCallback((e) => {
    uiVars.current.cumulativeDeltaX += e.clientX - uiVars.current.prevClientX;
    uiVars.current.prevClientX = e.clientX;
    setPanelWidth((prevPanelWidth) => {
      let newPanelWidth = Math.max(
        50, // panelWidth min: 50px
        prevPanelWidth - uiVars.current.cumulativeDeltaX
      );
      uiVars.current.cumulativeDeltaX = 0;
      return newPanelWidth;
    });
  }, []);

  const onStopDragging = React.useCallback(() => {
    setPanelWidth((panelWidth) => {
      setStoredPanelWidth(panelWidth);
      return panelWidth;
    });
  }, [setStoredPanelWidth]);

  const startDragging = useDragElement({
    onStartDragging,
    onDragging,
    onStopDragging,
  });

  const onSelectSubView = (
    e: React.SyntheticEvent<Element, Event>,
    index: number
  ) => {
    setSubViewIndex(index);
  };

  const tabs = [
    {
      id: "pipeline-properties",
      label: "Properties",
      icon: <TuneIcon />,
    },
    {
      id: "pipeline-logs",
      label: "Logs",
      icon: <ViewHeadlineIcon />,
    },
  ];

  const fileExists = useCheckFileValidity(
    projectUuid,
    pipelineUuid,
    step?.file_path
  );

  if (!eventVars.openedStep || !step || !pipelineJson) return null;

  return (
    <StepDetailsContainer
      style={{ width: panelWidth + "px" }}
      className="pipeline-details pane"
    >
      <ResizeBar onMouseDown={startDragging} />
      <Overflowable sx={{ display: "flex", flexDirection: "column" }}>
        <Tabs
          label="pipeline-details"
          value={subViewIndex}
          onChange={onSelectSubView}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              id={tab.id}
              label={<TabLabel icon={tab.icon}>{tab.label}</TabLabel>}
              aria-controls={tab.id}
              data-test-id={`${tab.id}-tab`}
            />
          ))}
        </Tabs>
        <CustomTabPanel value={subViewIndex} index={0} name="pipeline-details">
          <StepDetailsProperties
            projectUuid={projectUuid}
            pipelineUuid={pipelineJson.uuid}
            pipelineCwd={pipelineCwd}
            readOnly={isReadOnly}
            onSave={onSave}
            connections={connections}
            step={step}
            menuMaxWidth={`${panelWidth - 48}px`}
          />
        </CustomTabPanel>
        <CustomTabPanel value={subViewIndex} index={1} name="pipeline-logs">
          <StepDetailsLogs
            sio={sio}
            projectUuid={projectUuid}
            jobUuid={jobUuid}
            runUuid={runUuid}
            type="step"
            logId={step.uuid}
            pipelineUuid={pipelineJson.uuid}
          />
        </CustomTabPanel>
      </Overflowable>
      <Box sx={{ padding: (theme) => theme.spacing(2, 3, 0) }}>
        <Stack
          spacing={2}
          alignItems="flex-start"
          sx={{ marginBottom: (theme) => theme.spacing(2) }}
        >
          {!isReadOnly && (
            <Button
              startIcon={<LaunchIcon />}
              variant="contained"
              onClick={onOpenNotebook}
              onAuxClick={onOpenNotebook}
              data-test-id="step-view-in-jupyterlab"
              disabled={!fileExists}
            >
              Edit in JupyterLab
            </Button>
          )}
          <Button
            startIcon={<VisibilityIcon />}
            variant="contained"
            color="secondary"
            onClick={(e) => onOpenFilePreviewView(e, step.uuid)}
            onAuxClick={(e) => onOpenFilePreviewView(e, step.uuid)}
            data-test-id="step-view-file"
            disabled={!isReadOnly && !fileExists} // file exists endpoint doesn't consider job runs
          >
            View file
          </Button>
        </Stack>
        <Stack
          spacing={2}
          direction="row"
          sx={{ marginBottom: (theme) => theme.spacing(3) }}
        >
          <Button
            startIcon={<CloseIcon />}
            color="secondary"
            onClick={onClose}
            data-test-id="step-close-details"
          >
            Close
          </Button>
          {!isReadOnly && (
            <Button
              startIcon={<DeleteIcon />}
              color="secondary"
              onClick={onDelete}
              data-test-id="step-delete"
            >
              Delete
            </Button>
          )}
        </Stack>
      </Box>
    </StepDetailsContainer>
  );
};

export const StepDetails = React.memo(StepDetailsComponent);
