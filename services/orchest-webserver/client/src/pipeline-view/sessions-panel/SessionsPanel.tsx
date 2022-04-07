import SessionToggleButton from "@/components/SessionToggleButton";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { IOrchestSession } from "@/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import React from "react";
import { useFileManagerContext } from "../file-manager/FileManagerContext";

type SessionStatus = IOrchestSession["status"] | "";

export const SessionsPanel = () => {
  const { projectUuid } = useCustomRoute();
  const { pipelines } = useFileManagerContext();
  const { getSession } = useSessionsContext();

  return (
    <Box sx={{ margin: (theme) => theme.spacing(1) }}>
      <Typography variant="subtitle1" component="h3">
        Sessions
      </Typography>
      {pipelines.map((pipeline) => {
        const sessionStatus = (getSession({
          pipelineUuid: pipeline.uuid,
          projectUuid,
        })?.status || "") as SessionStatus;

        return (
          <SessionToggleButton
            projectUuid={projectUuid}
            pipelineUuid={pipeline.uuid}
            status={sessionStatus}
            sx={{
              width: "100%",
              maxWidth: "450px",
              margin: (theme) => theme.spacing(1, 2, 1, 0),
            }}
            label={
              <Typography
                variant="body2"
                component="span"
                sx={{
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  width: "100%",
                }}
              >
                {pipeline.name}
              </Typography>
            }
            isSwitch
            key={pipeline.uuid}
          />
        );
      })}
    </Box>
  );
};
