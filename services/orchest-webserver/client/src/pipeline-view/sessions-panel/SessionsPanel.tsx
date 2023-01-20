import { SessionToggleButton } from "@/components/SessionToggleButton";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCurrentQuery, useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchProjectPipelines } from "@/hooks/useFetchProjectPipelines";
import { siteMap } from "@/routingConfig";
import { OrchestSession } from "@/types";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";

type SessionStatus = OrchestSession["status"] | "";

export const SessionsPanel = () => {
  const { projectUuid } = useCurrentQuery();
  const { pipelines } = useFetchProjectPipelines(projectUuid);
  const { getSession } = useSessionsContext();
  const { navigateTo } = useCustomRoute();

  return (
    <Stack direction="column" sx={{ flex: 1, minHeight: 0 }}>
      <Typography
        variant="body1"
        component="h3"
        sx={{ padding: (theme) => theme.spacing(2) }}
      >
        Pipeline sessions
      </Typography>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: (theme) => theme.spacing(0, 1, 2, 2),
        }}
      >
        {Object.values(pipelines).map((pipeline) => {
          const sessionStatus = (getSession(pipeline.uuid)?.status ||
            "") as SessionStatus;

          const onClick = (event: React.MouseEvent) => {
            navigateTo(
              siteMap.pipeline.path,
              {
                query: {
                  projectUuid: pipeline.project_uuid,
                  pipelineUuid: pipeline.uuid,
                },
              },
              event
            );
          };

          return (
            <SessionToggleButton
              key={pipeline.uuid}
              pipelineUuid={pipeline.uuid}
              status={sessionStatus}
              sx={{
                width: "100%",
                margin: (theme) => theme.spacing(1, 0),
              }}
              label={
                <Tooltip
                  title={pipeline.path}
                  placement="bottom-start"
                  followCursor // To prevent tooltip blocking the next item.
                >
                  <Link
                    variant="body2"
                    underline="hover"
                    sx={{
                      cursor: "pointer !important",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      width: "100%",
                    }}
                    onClick={onClick}
                    onAuxClick={onClick}
                  >
                    {pipeline.path}
                  </Link>
                </Tooltip>
              }
            />
          );
        })}
      </Box>
    </Stack>
  );
};
