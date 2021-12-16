import { Overflowable } from "@/components/common/Overflowable";
import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
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
import PipelineDetailsLogs from "./PipelineDetailsLogs";
import PipelineDetailsProperties from "./PipelineDetailsProperties";

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

const PipelineDetailsContainer = styled("div")(({ theme }) => ({
  height: "100%",
  backgroundColor: theme.palette.common.white,
  borderLeft: `1px solid ${theme.palette.background.default}`,
  zIndex: 12,
  width: 0,
  display: "flex",
  flexDirection: "column",
}));

const PipelineDetails: React.FC<{
  onOpenNotebook: () => void;
  onOpenFilePreviewView?: (uuid: string) => void;
  onChangeView: (index: number) => void;
  onClose: () => void;
  onDelete: () => void;
  defaultViewIndex?: number;
  step: Step;
  readOnly?: boolean;
  project_uuid: string;
  [key: string]: any;
}> = ({
  defaultViewIndex = 0,
  onOpenNotebook,
  onOpenFilePreviewView,
  onChangeView,
  step,
  readOnly,
  onClose,
  onDelete,
  project_uuid,
  ...props
}) => {
  const [storedPanelWidth, setStoredPanelWidth] = useLocalStorage(
    "pipelinedetails.panelWidth",
    450
  );

  const eventVars = React.useRef({
    prevClientX: 0,
    cumulativeDeltaX: 0,
  });

  const [panelWidth, setPanelWidth] = React.useState(storedPanelWidth);

  const [subViewIndex, setSubViewIndex] = React.useState(defaultViewIndex);

  const openFilePreviewView = (step_uuid: string) =>
    onOpenFilePreviewView && onOpenFilePreviewView(step_uuid);

  const onStartDragging = React.useCallback((e: React.MouseEvent) => {
    eventVars.current.prevClientX = e.clientX;
    eventVars.current.cumulativeDeltaX = 0;
  }, []);

  const onDragging = React.useCallback((e) => {
    eventVars.current.cumulativeDeltaX +=
      e.clientX - eventVars.current.prevClientX;
    eventVars.current.prevClientX = e.clientX;
    setPanelWidth((prevPanelWidth) => {
      let newPanelWidth = Math.max(
        50, // panelWidth min: 50px
        prevPanelWidth - eventVars.current.cumulativeDeltaX
      );
      eventVars.current.cumulativeDeltaX = 0;
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
    onChangeView(index);
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

  return (
    <PipelineDetailsContainer
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
            />
          ))}
        </Tabs>
        <CustomTabPanel value={subViewIndex} index={0} name="pipeline-details">
          <PipelineDetailsProperties
            project_uuid={project_uuid}
            pipeline_uuid={props.pipeline.uuid}
            pipelineCwd={props.pipelineCwd}
            readOnly={readOnly}
            onNameUpdate={props.onNameUpdate}
            onSave={props.onSave}
            connections={props.connections}
            step={step}
            onChange={props.onChange}
            saveHash={props.saveHash}
            menuMaxWidth={`${panelWidth - 48}px`}
          />
        </CustomTabPanel>
        <CustomTabPanel value={subViewIndex} index={1} name="pipeline-logs">
          <PipelineDetailsLogs
            sio={props.sio}
            projectUuid={project_uuid}
            jobUuid={props.job_uuid}
            runUuid={props.run_uuid}
            stepUuid={step.uuid}
            pipelineUuid={props.pipeline.uuid}
          />
        </CustomTabPanel>
      </Overflowable>
      <Box sx={{ padding: (theme) => theme.spacing(2, 3, 0) }}>
        <Stack
          spacing={2}
          alignItems="flex-start"
          sx={{ marginBottom: (theme) => theme.spacing(2) }}
        >
          {!readOnly && (
            <Button
              startIcon={<LaunchIcon />}
              variant="contained"
              onClick={onOpenNotebook}
              data-test-id="step-view-in-jupyterlab"
            >
              Edit in JupyterLab
            </Button>
          )}
          <Button
            startIcon={<VisibilityIcon />}
            variant="contained"
            color="secondary"
            onClick={() => openFilePreviewView(step.uuid)}
            data-test-id="step-view-file"
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
          {!readOnly && (
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
    </PipelineDetailsContainer>
  );
};

export default PipelineDetails;
