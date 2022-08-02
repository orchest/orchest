import { EnvironmentState } from "@/types";
import { ellipsis } from "@/utils/styles";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PlayCircleFilledWhiteOutlinedIcon from "@mui/icons-material/PlayCircleFilledWhiteOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

type ElementStatusIconProps = {
  selected: boolean;
  action?: EnvironmentState["action"];
};

const ElementStatusIcon = ({ selected, action }: ElementStatusIconProps) => {
  if (selected) return <EditOutlinedIcon fontSize="small" color="action" />;
  if (action === "WAIT") return <CircularProgress size={20} />;
  if (action === "RETRY") return <ReplayOutlinedIcon fontSize="small" />;
  if (action === "BUILD")
    return <PlayCircleFilledWhiteOutlinedIcon fontSize="small" />;

  return <CheckCircleOutlineOutlinedIcon fontSize="small" color="success" />;
};

type EnvironmentMenuItemProps = EnvironmentState & {
  selected: boolean;
  onClick: (uuid: string) => void;
};

export const EnvironmentMenuItem = React.memo(function EnvironmentMenuItem({
  uuid,
  name,
  language,
  action,
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
        <ElementStatusIcon selected={selected} action={action} />
      </Stack>
    </MenuItem>
  );
});
