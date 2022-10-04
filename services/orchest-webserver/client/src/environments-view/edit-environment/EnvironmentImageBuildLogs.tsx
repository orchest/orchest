import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { ImageBuildLog } from "@/components/ImageBuildLog";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import "codemirror/mode/shell/shell";
import "codemirror/theme/dracula.css";
import React from "react";
import { useEditEnvironment } from "../stores/useEditEnvironment";

export const EnvironmentImageBuildLogs = () => {
  const { projectUuid, environmentUuid } = useCustomRoute();
  const { config } = useGlobalContext();

  const uuid = useEditEnvironment((state) => state.environmentChanges?.uuid);
  const latestBuild = useEditEnvironment(
    (state) => state.environmentChanges?.latestBuild
  );
  const environmentChangesProjectUuid = useEditEnvironment(
    (state) => state.environmentChanges?.project_uuid
  );

  const isTriggeringBuild = useEnvironmentsApi(
    (state) => state.isTriggeringBuild
  );

  const streamIdentity =
    hasValue(projectUuid) && hasValue(environmentUuid)
      ? `${projectUuid}-${environmentUuid}`
      : undefined;

  const streamIdentityFromStore = `${environmentChangesProjectUuid}-${uuid}`;

  const ignoreIncomingLogs =
    isTriggeringBuild || streamIdentity !== streamIdentityFromStore;

  return (
    <Accordion defaultExpanded>
      <AccordionSummary
        aria-controls="environment-build-logs"
        id="environment-build-logs-header"
      >
        <Typography component="h5" variant="h6">
          Logs
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <ImageBuildLog
          ignoreIncomingLogs={ignoreIncomingLogs}
          hideDefaultStatus
          build={latestBuild}
          socketIONamespace={
            config?.ORCHEST_SOCKETIO_ENV_IMG_BUILDING_NAMESPACE
          }
          streamIdentity={streamIdentity}
        />
      </AccordionDetails>
    </Accordion>
  );
};
