import Tab, { TabProps } from "@mui/material/Tab";
import Tooltip from "@mui/material/Tooltip";
import React from "react";

export const CustomTab = ({
  label,
  icon,
  onClick,
  ...props
}: Omit<TabProps, "label" | "icon"> & {
  label: string;
  icon?: React.ReactElement;
}) => {
  const ariaLabel = typeof label === "string" ? label : undefined;
  return (
    <Tab
      {...props}
      label={icon ? undefined : label}
      icon={icon ? <Tooltip title={label}>{icon}</Tooltip> : undefined}
      aria-label={ariaLabel}
      disableRipple
      sx={{
        height: (theme) => theme.spacing(7),
        paddingRight: (theme) => theme.spacing(icon ? 1 : 4),
        paddingLeft: (theme) => theme.spacing(icon ? 1 : 4),
        minWidth: (theme) => (icon ? theme.spacing(7) : undefined),
        "&.Mui-selected": {
          color: (theme) => theme.palette.common.black,
        },
        ":focus": {
          backgroundColor: (theme) => theme.palette.action.hover,
        },
      }}
      aria-controls={`navigate-to-${label}`}
      onClick={onClick}
    />
  );
};
