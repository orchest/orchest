import { ImageBuildLog } from "@/components/ImageBuildLog";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import "codemirror/mode/shell/shell";
import "codemirror/theme/dracula.css";
import React from "react";
import { useBuildEnvironmentImage } from "../hooks/useBuildEnvironmentImage";
import { useEditEnvironment } from "../stores/useEditEnvironment";
import {
  EnvironmentsAccordion,
  EnvironmentsAccordionDetails,
  EnvironmentsAccordionSummary,
} from "./components/EnvironmentsAccordion";
import { useEnvironmentsUiStateStore } from "./stores/useEnvironmentsUiStateStore";

export const EnvironmentImageBuildLogs = () => {
  const { projectUuid, environmentUuid } = useCustomRoute();
  const { config } = useGlobalContext();
  const { isLogsOpen, setIsLogsOpen } = useEnvironmentsUiStateStore();
  const { environmentChanges } = useEditEnvironment();
  const [, , isTriggeringBuild] = useBuildEnvironmentImage();

  const handleChange = (event: React.SyntheticEvent, isExpanded: boolean) => {
    setIsLogsOpen(isExpanded);
  };

  const streamIdentity =
    hasValue(projectUuid) && hasValue(environmentUuid)
      ? `${projectUuid}-${environmentUuid}`
      : undefined;

  const streamIdentityFromStore = `${environmentChanges?.project_uuid}-${environmentChanges?.uuid}`;

  const ignoreIncomingLogs =
    isTriggeringBuild || streamIdentity !== streamIdentityFromStore;

  return (
    <EnvironmentsAccordion expanded={isLogsOpen} onChange={handleChange}>
      <EnvironmentsAccordionSummary
        aria-controls="environment-build-logs"
        id="environment-build-logs-header"
      >
        <Typography component="h5" variant="h6">
          Logs
        </Typography>
      </EnvironmentsAccordionSummary>
      <EnvironmentsAccordionDetails>
        <ImageBuildLog
          ignoreIncomingLogs={ignoreIncomingLogs}
          hideDefaultStatus
          build={environmentChanges?.latestBuild}
          socketIONamespace={
            config?.ORCHEST_SOCKETIO_ENV_IMG_BUILDING_NAMESPACE
          }
          streamIdentity={streamIdentity}
        />
      </EnvironmentsAccordionDetails>
    </EnvironmentsAccordion>
  );
};
