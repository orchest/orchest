import { SnackBar } from "@/components/common/SnackBar";
import { useCurrentQuery, useNavigate } from "@/hooks/useCustomRoute";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import { isUuid } from "@/utils/uuid";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import blue from "@mui/material/colors/blue";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const ProjectNotFoundMessage = () => {
  const navigate = useNavigate();
  const { projectUuid } = useCurrentQuery();
  const { isFetched, hasData, projects } = useFetchProjects();
  const lastSeenUuidRef = React.useRef(projectUuid);
  lastSeenUuidRef.current = projectUuid ?? lastSeenUuidRef.current;

  const [isShowing, setIsShowing] = React.useState(false);

  React.useEffect(() => {
    if (!hasValue(projectUuid) || !isFetched || !hasData) return;

    if (!projects[projectUuid]) {
      setIsShowing(true);
      navigate({ route: "projects", sticky: false });
    }
  }, [hasData, isFetched, navigate, projectUuid, projects]);

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
          It may have been deleted.
        </Box>
      }
      action={
        <Button
          size="small"
          onClick={() => setIsShowing(false)}
          sx={{ color: blue[200] }}
        >
          OK
        </Button>
      }
    />
  );
};
