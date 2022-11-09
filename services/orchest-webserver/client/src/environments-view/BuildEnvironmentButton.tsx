import BuildCircleOutlinedIcon from "@mui/icons-material/BuildCircleOutlined";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useBuildEnvironmentImage } from "./hooks/useBuildEnvironmentImage";
import { useEditEnvironment } from "./stores/useEditEnvironment";

export const BuildEnvironmentButton = () => {
  const uuid = useEditEnvironment((state) => state.changes?.uuid);
  const latestBuild = useEditEnvironment((state) => state.changes?.latestBuild);
  const [triggerBuild, cancelBuild] = useBuildEnvironmentImage();

  const buildStatus = latestBuild?.status;

  const isBuilding =
    hasValue(buildStatus) && ["PENDING", "STARTED"].includes(buildStatus);

  const handleClick = () => {
    if (!uuid) return;
    if (isBuilding) {
      cancelBuild(uuid);
    } else {
      triggerBuild([uuid]);
    }
  };

  const buttonIcon = isBuilding ? (
    <CircularProgress
      size={20}
      sx={{ color: (theme) => theme.palette.background.paper }}
    />
  ) : (
    <BuildCircleOutlinedIcon fontSize="small" />
  );

  return (
    <Button variant="contained" startIcon={buttonIcon} onClick={handleClick}>
      {isBuilding ? "Cancel" : "Build"}
    </Button>
  );
};
