import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import Link, { LinkProps } from "@mui/material/Link";
import React from "react";

type ViewDocsLinkProps = LinkProps & { docPath?: string };

export const ViewDocsLink = ({
  sx,
  docPath = "",
  ...props
}: ViewDocsLinkProps) => {
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
      href={`https://docs.orchest.io/en/stable${docPath}`}
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
