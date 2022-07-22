import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import { Alert, AlertTitle } from "@mui/material";
import React from "react";
import { Link } from "react-router-dom";

export function SnapshotBanner() {
  return (
    <Alert color="info" icon={<VisibilityIcon />}>
      <AlertTitle>Read-only: pipeline snapshot</AlertTitle>
      This is a read-only pipeline snapshot from a job. To make edits, go to the{" "}
      <Link to="/pipeline">pipeline editor</Link>
    </Alert>
  );
}
