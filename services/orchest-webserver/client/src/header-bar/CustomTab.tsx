import Tab, { TabProps } from "@mui/material/Tab";
import React from "react";

export const CustomTab = ({ label, icon, onClick, ...props }: TabProps) => {
  return (
    <Tab
      {...props}
      label={label}
      icon={icon}
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
