import { ImageBuildLog } from "@/components/ImageBuildLog";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import "codemirror/mode/shell/shell";
import "codemirror/theme/dracula.css";
import React from "react";
import { useBuildEnvironmentImage } from "../hooks/useBuildEnvironmentImage";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";
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
  const { environmentOnEdit } = useEnvironmentOnEdit();
  const [, , isTriggeringBuild] = useBuildEnvironmentImage();

  const handleChange = (event: React.SyntheticEvent, isExpanded: boolean) => {
    setIsLogsOpen(isExpanded);
  };

  const streamIdentity =
    hasValue(projectUuid) && hasValue(environmentUuid)
      ? `${projectUuid}-${environmentUuid}`
      : undefined;

  const streamIdentityFromStore = `${environmentOnEdit?.project_uuid}-${environmentOnEdit?.uuid}`;

  const ignoreIncomingLogs =
    isTriggeringBuild || streamIdentity !== streamIdentityFromStore;

  return (
    <EnvironmentsAccordion expanded={isLogsOpen} onChange={handleChange}>
      <EnvironmentsAccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="setup-script"
        id="setup-script-header"
      >
        <Typography component="h5" variant="h6">
          Logs
        </Typography>
      </EnvironmentsAccordionSummary>
      <EnvironmentsAccordionDetails>
        <ImageBuildLog
          ignoreIncomingLogs={ignoreIncomingLogs}
          hideDefaultStatus
          build={environmentOnEdit?.latestBuild}
          socketIONamespace={
            config?.ORCHEST_SOCKETIO_ENV_IMG_BUILDING_NAMESPACE
          }
          streamIdentity={streamIdentity}
        />
      </EnvironmentsAccordionDetails>
    </EnvironmentsAccordion>
  );
};
