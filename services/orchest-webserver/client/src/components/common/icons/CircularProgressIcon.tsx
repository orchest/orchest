import CircularProgress, {
  CircularProgressProps,
} from "@mui/material/CircularProgress";
import React from "react";

type IconFontSize = "small" | "medium";
const iconSizeMapping: Record<IconFontSize, number> = {
  medium: 18,
  small: 16,
};

type LabelIconColor = CircularProgressProps["color"];

export const CircularProgressIcon = ({
  fontSize = "small",
  color = "primary",
}: {
  fontSize?: IconFontSize;
  color?: LabelIconColor;
}) => {
  return (
    <CircularProgress
      size={iconSizeMapping[fontSize]}
      color={color}
      sx={{ marginLeft: (theme) => theme.spacing(0.5) }}
    />
  );
};
