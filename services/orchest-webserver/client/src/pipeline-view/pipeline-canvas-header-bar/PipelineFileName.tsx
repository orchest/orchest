import { useProjectsContext } from "@/contexts/ProjectsContext";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";

export const PipelineFileName = () => {
  const {
    state: { pipeline },
  } = useProjectsContext();
  const { path = "" } = pipeline || {};

  const fileNameWithoutExtension = React.useMemo(() => {
    const fileNameWithExtension = path.split("/").slice(-1)[0];
    return fileNameWithExtension.replace(/\.orchest$/, "");
  }, [path]);

  return (
    <Tooltip title={`Project files/${path}`} placement="bottom-start">
      <Stack direction="row" alignItems="baseline" sx={{ flex: 1 }}>
        {path.length > 0 && (
          <>
            <Typography component="h2" variant="h5">
              {fileNameWithoutExtension}
            </Typography>
            <Typography variant="subtitle2">.orchest</Typography>
          </>
        )}
      </Stack>
    </Tooltip>
  );
};
