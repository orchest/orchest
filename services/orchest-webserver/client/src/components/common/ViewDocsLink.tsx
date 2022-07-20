import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import Link, { LinkProps } from "@mui/material/Link";
import React from "react";

export const ViewDocsLink = ({ sx, ...props }: LinkProps) => {
  return (
    <Link
      underline="hover"
      sx={{
        cursor: "pointer",
        textTransform: "uppercase",
        fontSize: (theme) => theme.typography.button.fontSize,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        ...sx,
      }}
      target="_blank"
      rel="noopener noreferrer"
      href="https://docs.orchest.io/en/stable/fundamentals/projects.html"
      {...props}
    >
      View docs
      <LaunchOutlinedIcon
        fontSize="small"
        sx={{ marginLeft: (theme) => theme.spacing(0.5) }}
      />
    </Link>
  );
};
