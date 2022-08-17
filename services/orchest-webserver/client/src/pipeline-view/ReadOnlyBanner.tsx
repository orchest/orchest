import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useLayoutStore } from "@/components/Layout/layout-with-side-panel/stores/useLayoutStore";
import { useBuildEnvironmentImages } from "@/hooks/useBuildEnvironmentImages";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "./contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "./contexts/PipelineUiStateContext";

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

  const { secondarySidePanelWidth } = useLayoutStore();

  const widthDiff = openedStep ? secondarySidePanelWidth : 0;

  return (
    <Box
      style={{ maxWidth: `calc(100% - ${widthDiff}px)`, width: "100%" }}
      sx={{
        padding: (theme) => theme.spacing(1),
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
  const { buildingEnvironments, environmentsToBeBuilt } = useEnvironmentsApi();

  const { triggerBuild, viewBuildStatus } = useBuildEnvironmentImages();

  const {
    job,
    pipelineReadOnlyReason,
    projectUuid,
    pipelineUuid,
  } = usePipelineDataContext();

  const { title, action, actionLabel } = React.useMemo(() => {
    switch (pipelineReadOnlyReason) {
      case "isJobRun":
        return {
          title: "Pipeline snapshot",
          actionLabel: "Open in editor",
          action: (event: React.MouseEvent) =>
            navigateTo(
              siteMap.pipeline.path,
              { query: { projectUuid, pipelineUuid } },
              event
            ),
        };
      case "JupyterEnvironmentBuildInProgress":
        return {
          title: "JupyterLab environment build is in progress",
          actionLabel: "JupyterLab configuration",
          action: (event: React.MouseEvent) =>
            navigateTo(siteMap.configureJupyterLab.path, undefined, event),
        };
      case "environmentsNotYetBuilt":
        const hasMultipleEnvironmentsToBuild = environmentsToBeBuilt.length > 1;
        const environmentText = hasMultipleEnvironmentsToBuild
          ? `${environmentsToBeBuilt.length} environments`
          : "One environment";
        return {
          title: `${environmentText} of this project need${
            hasMultipleEnvironmentsToBuild ? "" : "s"
          } to be built`,
          actionLabel: "Build environments",
          action: triggerBuild,
        };
      case "environmentsBuildInProgress":
        const hasMultipleEnvironmentsBuilding = buildingEnvironments.length > 1;
        return {
          title: `${buildingEnvironments.length} environment${
            hasMultipleEnvironmentsBuilding ? "s" : ""
          } still building`,
          actionLabel: "Open environments",
          action: viewBuildStatus,
        };
      default:
        return {};
    }
  }, [
    navigateTo,
    pipelineReadOnlyReason,
    environmentsToBeBuilt,
    buildingEnvironments,
    projectUuid,
    pipelineUuid,
    viewBuildStatus,
    triggerBuild,
  ]);

  return hasValue(pipelineReadOnlyReason) ? (
    <ReadOnlyBannerContainer>
      <Alert
        severity="info"
        icon={false}
        action={
          <Button
            sx={{ cursor: "pointer", whiteSpace: "nowrap" }}
            onClick={action}
            onAuxClick={action}
          >
            {actionLabel}
          </Button>
        }
        sx={{ width: "100%", alignItems: "center" }}
      >
        <Box
          sx={{
            fontWeight: (theme) => theme.typography.subtitle2.fontWeight,
          }}
        >
          Read-only: {title}
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
