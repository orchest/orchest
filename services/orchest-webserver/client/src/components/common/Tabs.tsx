import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { SxProps, Theme } from "@mui/material/styles";
import MuiTabs from "@mui/material/Tabs";
import React from "react";

export const TabLabel: React.FC<{ icon?: React.ReactNode }> = ({
  children,
  icon,
}) => (
  <Stack direction="row" alignItems="center">
    {icon}
    <Box sx={{ marginLeft: (theme) => theme.spacing(1) }}>{children}</Box>
  </Stack>
);

export const TabPanel: React.FC<{
  value: number;
  index: number;
  name: string;
  sx?: SxProps<Theme>;
}> = (props) => {
  const { children, value, index, name, sx, ...other } = props;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${name}`}
      aria-labelledby={`tab-${name}`}
      sx={{ flex: 1, padding: (theme) => theme.spacing(1), ...sx }}
      {...other}
    >
      {value === index && children}
    </Box>
  );
};

// Add the bottom border
export const Tabs: React.FC<{
  label: string;
  value: number | string;
  onChange: (e: React.SyntheticEvent<Element, Event>, tabIndex: number) => void;
  ["data-test-id"]?: string;
  style?: React.CSSProperties;
}> = ({
  label,
  value,
  onChange,
  children,
  ["data-test-id"]: testId,
  style,
}) => {
  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <MuiTabs
        value={value}
        onChange={(e, newIndex) => onChange(e, newIndex)}
        aria-label={label}
        data-test-id={testId}
        style={style}
      >
        {children}
      </MuiTabs>
    </Box>
  );
};
