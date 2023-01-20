import { SnackBar } from "@/components/common/SnackBar";
import { useCurrentQuery, useNavigate } from "@/hooks/useCustomRoute";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import { isProjectPage } from "@/routingConfig";
import { isUuid } from "@/utils/uuid";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const ProjectNotFoundMessage = () => {
  const navigate = useNavigate();
  const { projectUuid } = useCurrentQuery();
  const { isLoaded, hasData, projects } = useFetchProjects();
  const lastSeenUuidRef = React.useRef(projectUuid);
  lastSeenUuidRef.current = projectUuid ?? lastSeenUuidRef.current;

  const [isShowing, setIsShowing] = React.useState(false);

  React.useEffect(() => {
    if (!hasValue(projectUuid) || !isLoaded || !hasData) return;

    if (!projects[projectUuid] && isProjectPage(window.location.href)) {
      navigate({ route: "home", query: { tab: "projects" }, sticky: false });
      setIsShowing(true);
    }
  }, [hasData, isLoaded, navigate, projectUuid, projects]);

  const open =
    isShowing &&
    hasValue(lastSeenUuidRef.current) &&
    isUuid(lastSeenUuidRef.current);

  React.useEffect(() => {
    if (!open) return;

    const handle = window.setTimeout(() => setIsShowing(false), 7500);

    return () => window.clearTimeout(handle);
  }, [open]);

  return (
    <SnackBar
      open={
        isShowing &&
        hasValue(lastSeenUuidRef.current) &&
        isUuid(lastSeenUuidRef.current)
      }
      message={
        <Box>
          <Typography variant="subtitle2">
            Project <code>{lastSeenUuidRef.current}</code> was not found
          </Typography>
        </Box>
      }
    />
  );
};
