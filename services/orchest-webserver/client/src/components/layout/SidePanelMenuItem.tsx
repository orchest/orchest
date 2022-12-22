import { ellipsis } from "@/utils/styles";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";

type SidePanelMenuItemProps = {
  uuid: string;
  title: string;
  subtitle?: string;
  statusIcon?: React.ReactNode;
  statusIconTooltip?: string;
  selected: boolean;
  showStatusIcon?: boolean;
  divider?: boolean;
  onClick: (event: React.MouseEvent, uuid: string) => void;
};

export const SidePanelMenuItem = React.memo(function SidePanelMenuItem({
  uuid,
  title,
  subtitle,
  statusIcon,
  statusIconTooltip,
  selected,
  onClick,
  divider = true,
  showStatusIcon,
}: SidePanelMenuItemProps) {
  const isTitleEmpty = title.trim().length === 0;
  return (
    <MenuItem
      key={uuid}
      selected={selected}
      divider={divider}
      onClick={(event) => onClick(event, uuid)}
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
        <Typography
          variant="body1"
          sx={{
            ...ellipsis(),
            color: (theme) =>
              isTitleEmpty ? theme.palette.action.active : "inherent",
          }}
        >
          {isTitleEmpty ? "(Unnamed)" : title}
        </Typography>
        {subtitle && (
          <Typography
            variant="body2"
            sx={{
              ...ellipsis(),
              color: (theme) => theme.palette.action.active,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Stack>
      {showStatusIcon && statusIconTooltip && (
        <Tooltip title={statusIconTooltip}>
          <Stack
            justifyContent="center"
            alignItems="center"
            sx={{ paddingLeft: (theme) => theme.spacing(1) }}
          >
            {statusIcon}
          </Stack>
        </Tooltip>
      )}
    </MenuItem>
  );
});
