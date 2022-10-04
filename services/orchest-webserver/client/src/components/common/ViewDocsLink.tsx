import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import Button from "@mui/material/Button";
import Link, { LinkProps } from "@mui/material/Link";
import React from "react";

type ViewDocsLinkProps = LinkProps & { docPath?: string };

export const ViewDocsLink = ({ docPath = "", ...props }: ViewDocsLinkProps) => {
  return (
    <Link
      underline="hover"
      target="_blank"
      rel="noopener noreferrer"
      href={`https://docs.orchest.io/en/stable${docPath}`}
      {...props}
    >
      <Button
        variant="text"
        endIcon={
          <LaunchOutlinedIcon
            sx={{ marginLeft: (theme) => theme.spacing(0.5) }}
          />
        }
      >
        View docs
      </Button>
    </Link>
  );
};
