import { useProjectsContext } from "@/contexts/ProjectsContext";
import { basename } from "@/utils/path";
import { ellipsis } from "@/utils/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";

export const PipelineFileName = () => {
  const {
    state: { pipeline },
  } = useProjectsContext();
  const { path = "" } = pipeline || {};

  const fileNameWithoutExtension = React.useMemo(
    () => basename(path).replace(/\.orchest$/, ""),
    [path]
  );

  return fileNameWithoutExtension ? (
    <Tooltip title={`Project files/${path}`} placement="bottom-start">
      <>
        <Typography component="h2" variant="h5" sx={ellipsis()}>
          {fileNameWithoutExtension}
        </Typography>
        <Typography variant="subtitle2">.orchest</Typography>
      </>
    </Tooltip>
  ) : null;
};
