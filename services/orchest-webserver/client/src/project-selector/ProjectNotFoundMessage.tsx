import { SnackBar } from "@/components/common/SnackBar";
import { useCurrentQuery, useNavigate } from "@/hooks/useCustomRoute";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import { useOnce } from "@/hooks/useOnce";
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

  const [isShowing, setIsShowing] = React.useState(false);
  const originalUuid = useOnce(Boolean(projectUuid), () => projectUuid);

  useOnce(hasValue(originalUuid) && isFetched && hasData, () => {
    if (!originalUuid || projects?.[originalUuid]) return;

    setIsShowing(true);
    navigate({ route: "projects", sticky: false });
  });

  return (
    <SnackBar
      open={isShowing && hasValue(originalUuid) && isUuid(originalUuid)}
      message={
        <Box>
          <Typography variant="subtitle2">
            Project <code>{originalUuid}</code> was not found
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
