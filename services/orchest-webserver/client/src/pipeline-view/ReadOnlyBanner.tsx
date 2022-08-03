import { PipelineReadOnlyReason } from "@/contexts/ProjectsContext";
import { useBuildEnvironmentImages } from "@/hooks/useBuildEnvironmentImages";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import { Alert } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineCanvasDimensionsContext } from "./contexts/PipelineCanvasDimensionsContext";
import { usePipelineDataContext } from "./contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "./contexts/PipelineUiStateContext";

const titleMapping: Record<PipelineReadOnlyReason, string> = {
  isJobRun: "pipeline snapshot",
  environmentsNotYetBuilt:
    "Not all environments of this project have been built",
  environmentsBuildInProgress: "Environment build is in progress...",
  JupyterEnvironmentBuildInProgress:
    "JupyterLab environment build is in progress",
};

const generateReadOnlyMessage = (jobName: string | undefined) =>
  jobName ? (
    <>
      {`This is a read-only pipeline snapshot from `}
      <b>{jobName}</b>
      {` job. Make edits in the Pipeline editor.`}
    </>
  ) : null;

type ReadOnlyBannerContainerProps = { children: React.ReactNode };

const ReadOnlyBannerContainer = ({
  children,
}: ReadOnlyBannerContainerProps) => {
  const {
    uiState: { openedStep },
  } = usePipelineUiStateContext();

  const {
    mainSidePanelWidth,
    stepDetailsPanelWidth,
  } = usePipelineCanvasDimensionsContext();

  const widthDiff = openedStep
    ? mainSidePanelWidth + stepDetailsPanelWidth
    : mainSidePanelWidth;

  return (
    <Box
      style={{ maxWidth: `calc(100% - ${widthDiff}px)`, width: "100%" }}
      sx={{
        padding: (theme) => theme.spacing(2.5),
        position: "absolute",
        top: (theme) => theme.spacing(7),
      }}
    >
      {children}
    </Box>
  );
};

export const ReadOnlyBanner = () => {
  const { navigateTo } = useCustomRoute();

  const { triggerBuild, viewBuildStatus } = useBuildEnvironmentImages();

  const {
    job,
    pipelineReadOnlyReason,
    projectUuid,
    pipelineUuid,
  } = usePipelineDataContext();

  const { action, label } = React.useMemo(() => {
    if (pipelineReadOnlyReason === "isJobRun") {
      return {
        action: (event: React.MouseEvent) => {
          navigateTo(
            siteMap.pipeline.path,
            { query: { projectUuid, pipelineUuid } },
            event
          );
        },
        label: "Open in editor",
      };
    } else if (pipelineReadOnlyReason === "JupyterEnvironmentBuildInProgress") {
      return {
        action: (event: React.MouseEvent) => {
          navigateTo(siteMap.configureJupyterLab.path, undefined, event);
        },
        label: "JupyterLab configuration",
      };
    } else if (pipelineReadOnlyReason === "environmentsNotYetBuilt") {
      return {
        action: triggerBuild,
        label: "Start Building",
      };
    } else if (pipelineReadOnlyReason === "environmentsBuildInProgress") {
      return {
        action: viewBuildStatus,
        label: "Open Environments",
      };
    } else {
      return {};
    }
  }, [
    navigateTo,
    pipelineReadOnlyReason,
    projectUuid,
    pipelineUuid,
    viewBuildStatus,
    triggerBuild,
  ]);

  return hasValue(pipelineReadOnlyReason) ? (
    <ReadOnlyBannerContainer>
      <Alert
        severity="info"
        action={
          <Button
            sx={{ cursor: "pointer", whiteSpace: "nowrap" }}
            onClick={action}
            onAuxClick={action}
          >
            {label}
          </Button>
        }
        icon={<VisibilityIcon />}
        sx={{
          width: "100%",
        }}
      >
        <Box
          sx={{ fontWeight: (theme) => theme.typography.subtitle2.fontWeight }}
        >
          Read-only: {titleMapping[pipelineReadOnlyReason]}
        </Box>
        {pipelineReadOnlyReason === "isJobRun" && hasValue(job) && (
          <Typography variant="body2">
            {generateReadOnlyMessage(job.name)}
          </Typography>
        )}
      </Alert>
    </ReadOnlyBannerContainer>
  ) : null;
};
