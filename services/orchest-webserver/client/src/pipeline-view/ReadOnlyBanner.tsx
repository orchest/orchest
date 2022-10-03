import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useSecondarySidePanelWidth } from "@/components/layout/stores/useLayoutStore";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useBuildEnvironmentImages } from "@/hooks/useBuildEnvironmentImages";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { withPlural } from "@/utils/webserver-utils";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "./contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "./contexts/PipelineUiStateContext";

const generateReadOnlyMessage = (jobName: string | undefined) =>
  jobName ? (
    <>
      {`This is a read-only pipeline snapshot from the `}
      <strong>{jobName}</strong>
      {` job.`}
    </>
  ) : null;

const ReadOnlyBannerContainer: React.FC = ({ children }) => {
  const {
    uiState: { openedStep },
  } = usePipelineUiStateContext();

  const [secondarySidePanelWidth] = useSecondarySidePanelWidth();

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
  const buildingEnvironments = useEnvironmentsApi(
    (state) => state.buildingEnvironments
  );
  const environmentsToBeBuilt = useEnvironmentsApi(
    (state) => state.environmentsToBeBuilt
  );

  const {
    state: { pipelineReadOnlyReason },
    dispatch,
  } = useProjectsContext();

  const { triggerBuilds, viewBuildStatus } = useBuildEnvironmentImages();

  const { job, projectUuid } = usePipelineDataContext();

  const { title, action, actionLabel } = React.useMemo(() => {
    switch (pipelineReadOnlyReason) {
      case "isJobRun":
        return {
          title: `Job run snapshot`,
          actionLabel: "View all runs",
          action: (event: React.MouseEvent) =>
            navigateTo(
              siteMap.jobs.path,
              { query: { projectUuid, jobUuid: job?.uuid } },
              event
            ),
        };
      case "isSnapshot":
        return {
          title: `Pipeline snapshot`,
          actionLabel: "View all runs",
          action: (event: React.MouseEvent) =>
            navigateTo(
              siteMap.jobs.path,
              { query: { projectUuid, jobUuid: job?.uuid } },
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
      case "environmentsFailedToBuild":
        const hasMultipleEnvironmentsToBuild = environmentsToBeBuilt.length > 1;
        const environmentText = withPlural(
          environmentsToBeBuilt.length,
          "environment"
        );

        return {
          title: `${environmentText} of this project need${
            hasMultipleEnvironmentsToBuild ? "" : "s"
          } to be built`,
          actionLabel: "Build environments",
          action: () => {
            dispatch({
              type: "SET_PIPELINE_READONLY_REASON",
              payload: "environmentsBuildInProgress",
            });
            triggerBuilds();
          },
        };
      case "environmentsBuildInProgress":
        const buildingEnvironmentText = withPlural(
          buildingEnvironments.length,
          "environment"
        );
        return {
          title: `${buildingEnvironmentText} still building`,
          actionLabel: "Open environments",
          action: viewBuildStatus,
        };
      default:
        return {};
    }
  }, [
    pipelineReadOnlyReason,
    environmentsToBeBuilt.length,
    buildingEnvironments.length,
    viewBuildStatus,
    navigateTo,
    projectUuid,
    job?.uuid,
    dispatch,
    triggerBuilds,
  ]);

  const showLinearProgress =
    pipelineReadOnlyReason === "environmentsBuildInProgress";

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
        sx={{
          width: "100%",
          alignItems: "center",
          paddingBottom: (theme) =>
            theme.spacing(showLinearProgress ? 2 : 0.75),
        }}
      >
        <Box
          sx={{
            fontWeight: (theme) => theme.typography.subtitle2.fontWeight,
          }}
        >
          Read-only: {title}
        </Box>
        {(pipelineReadOnlyReason === "isJobRun" ||
          pipelineReadOnlyReason === "isSnapshot") &&
          hasValue(job) && (
            <Typography variant="body2">
              {generateReadOnlyMessage(job.name)}
            </Typography>
          )}
      </Alert>
      {showLinearProgress && (
        <Box
          sx={{
            marginTop: (theme) => theme.spacing(-2),
            padding: (theme) => theme.spacing(0, 2),
          }}
        >
          <LinearProgress />
        </Box>
      )}
    </ReadOnlyBannerContainer>
  ) : null;
};
