import SessionToggleButton from "@/components/SessionToggleButton";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { IOrchestSession } from "@/types";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

type SessionStatus = IOrchestSession["status"] | "";

export const SessionsPanel = () => {
  const {
    state: { projectUuid, pipelines = [] },
  } = useProjectsContext();
  const { getSession } = useSessionsContext();

  return (
    <Stack direction="column" sx={{ flex: 1, minHeight: 0 }}>
      <Typography
        variant="subtitle2"
        component="h3"
        sx={{ padding: (theme) => theme.spacing(0.5, 0.5, 0.5, 1.5) }}
      >
        Sessions
      </Typography>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          paddingBottom: (theme) => theme.spacing(2),
        }}
      >
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
                margin: (theme) => theme.spacing(1, 0),
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
    </Stack>
  );
};
