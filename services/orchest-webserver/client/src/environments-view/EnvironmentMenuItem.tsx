import { EnvironmentState } from "@/types";
import { ellipsis } from "@/utils/styles";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import NoteAltOutlinedIcon from "@mui/icons-material/NoteAltOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { isEnvironmentBuilding, isEnvironmentFailedToBuild } from "./common";

type BuildStatusIconProps = {
  selected: boolean;
  latestBuild?: EnvironmentState["latestBuild"];
};

const BuildStatusIcon = ({ selected, latestBuild }: BuildStatusIconProps) => {
  if (selected) return <EditOutlinedIcon fontSize="small" color="action" />;
  if (latestBuild?.status === "INITIALIZING") return null;
  if (latestBuild?.status === "SUCCESS")
    return <CheckCircleOutlineOutlinedIcon fontSize="small" color="success" />;
  if (isEnvironmentBuilding(latestBuild)) return <CircularProgress size={20} />;
  if (isEnvironmentFailedToBuild(latestBuild))
    return <CancelOutlinedIcon fontSize="small" color="error" />;
  if (latestBuild?.status === "PAUSED")
    return <ReplayOutlinedIcon fontSize="small" />;

  return <NoteAltOutlinedIcon fontSize="small" />;
};

type EnvironmentMenuItemProps = EnvironmentState & {
  selected: boolean;
  onClick: (uuid: string) => void;
};

export const EnvironmentMenuItem = React.memo(function EnvironmentMenuItem({
  uuid,
  name,
  language,
  latestBuild,
  selected,
  onClick,
}: EnvironmentMenuItemProps) {
  return (
    <MenuItem
      key={uuid}
      tabIndex={0}
      selected={selected}
      divider
      onClick={() => onClick(uuid)}
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Stack
        direction="column"
        alignItems="flex-start"
        justifyContent="center"
        sx={{
          flexShrink: 1,
          width: (theme) => `calc(100% - ${theme.spacing(4)})`,
          margin: (theme) => theme.spacing(1, 0),
        }}
      >
        <Typography variant="body1" sx={ellipsis()}>
          {name}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            ...ellipsis(),
            color: (theme) => theme.palette.action.active,
          }}
        >
          {language}
        </Typography>
      </Stack>
      <Stack
        justifyContent="center"
        alignItems="center"
        sx={{ paddingLeft: (theme) => theme.spacing(1) }}
      >
        <BuildStatusIcon selected={selected} latestBuild={latestBuild} />
      </Stack>
    </MenuItem>
  );
});
