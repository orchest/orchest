import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { ImageBuildLog } from "@/components/ImageBuildLog";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFocusBrowserTab } from "@/hooks/useFocusBrowserTab";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import "codemirror/mode/shell/shell";
import "codemirror/theme/dracula.css";
import React from "react";
import { useEditEnvironment } from "../stores/useEditEnvironment";

export const EnvironmentImageBuildLogs = () => {
  const { projectUuid, environmentUuid } = useCustomRoute();
  const config = useOrchestConfigsApi((state) => state.config);

  const uuid = useEditEnvironment((state) => state.changes?.uuid);
  const latestBuild = useEditEnvironment((state) => state.changes?.latestBuild);
  const environmentChangesProjectUuid = useEditEnvironment(
    (state) => state.changes?.project_uuid
  );

  const isTriggeringBuild = useEnvironmentsApi(
    (state) => state.isTriggeringBuild
  );

  const streamIdentity =
    hasValue(projectUuid) && hasValue(environmentUuid)
      ? `${projectUuid}-${environmentUuid}`
      : undefined;

  const streamIdentityFromStore = `${environmentChangesProjectUuid}-${uuid}`;
  // SocketIO connection is disconnected when browser tab loses focus.
  // Rest logs upon disconnection, in order to prevent duplicated logs when connections is re-established.
  const isBrowserTabFocused = useFocusBrowserTab();

  const shouldCleanLogs =
    !isBrowserTabFocused ||
    isTriggeringBuild ||
    streamIdentity !== streamIdentityFromStore;

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
          shouldCleanLogs={shouldCleanLogs}
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
