import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Link from "@mui/material/Link";
import React from "react";

export const WebhookDocLink: React.FC = ({ children }) => {
  return (
    <Link
      variant="body2"
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        margin: (theme) => theme.spacing(0, 1, 0, 2),
      }}
      href="https://google.com" // TODO: change this
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <OpenInNewIcon
        sx={{
          fontSize: (theme) => theme.spacing(2),
          marginLeft: (theme) => theme.spacing(0.5),
        }}
      />
    </Link>
  );
};
