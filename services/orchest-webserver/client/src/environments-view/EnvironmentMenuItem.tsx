import { EnvironmentState } from "@/types";
import { ellipsis } from "@/utils/styles";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";
import { BuildStatusIcon } from "./BuildStatusIcon";
import { LANGUAGE_MAP } from "./common";

type EnvironmentMenuItemProps = EnvironmentState & {
  selected: boolean;
  showStatusIcon: boolean;
  onClick: (uuid: string) => void;
};

export const EnvironmentMenuItem = React.memo(function EnvironmentMenuItem({
  uuid,
  name,
  language,
  latestBuild,
  selected,
  onClick,
  showStatusIcon,
}: EnvironmentMenuItemProps) {
  const isNameEmpty = name.trim().length === 0;
  return (
    <MenuItem
      key={uuid}
      selected={selected}
      divider
      onClick={() => onClick(uuid)}
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
      }}
      autoFocus={selected}
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
        <Typography
          variant="body1"
          sx={{
            ...ellipsis(),
            color: (theme) =>
              isNameEmpty ? theme.palette.action.active : "inherent",
          }}
        >
          {isNameEmpty ? "(Unnamed)" : name}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            ...ellipsis(),
            color: (theme) => theme.palette.action.active,
          }}
        >
          {LANGUAGE_MAP[language]}
        </Typography>
      </Stack>
      {showStatusIcon && (
        <Tooltip title={latestBuild?.status || "Draft"}>
          <Stack
            justifyContent="center"
            alignItems="center"
            sx={{ paddingLeft: (theme) => theme.spacing(1) }}
          >
            <BuildStatusIcon latestBuild={latestBuild} />
          </Stack>
        </Tooltip>
      )}
    </MenuItem>
  );
});
