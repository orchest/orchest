import BuildCircleOutlinedIcon from "@mui/icons-material/BuildCircleOutlined";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useBuildEnvironmentImage } from "./hooks/useBuildEnvironmentImage";
import { useEnvironmentOnEdit } from "./stores/useEnvironmentOnEdit";

export const BuildEnvironmentButton = () => {
  const { environmentOnEdit } = useEnvironmentOnEdit();
  const [triggerBuild, cancelBuild] = useBuildEnvironmentImage();

  const buildStatus = environmentOnEdit?.latestBuild?.status;

  const isBuilding =
    hasValue(buildStatus) && ["PENDING", "STARTED"].includes(buildStatus);

  const handleClick = () => {
    if (!environmentOnEdit) return;

    if (isBuilding) {
      cancelBuild(environmentOnEdit.uuid);
    } else {
      triggerBuild(environmentOnEdit.uuid);
    }
  };

  const buttonIcon = isBuilding ? (
    <CircularProgress
      size={20}
      sx={{ color: (theme) => theme.palette.grey[400] }}
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
