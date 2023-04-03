import { alpha } from "@mui/material";
import { grey } from "@mui/material/colors";
import blue from "@mui/material/colors/blue";
import green from "@mui/material/colors/green";
import red from "@mui/material/colors/red";
import capitalize from "@mui/utils/capitalize";

// Based on this Figma design:
//  www.figma.com/file/NG8wSY060uMO4ho6EJ634T/ORC-917-System-status?node-id=175%3A42221&t=uNYJuF1MmXEMziir-0

export type SystemStatus =
  | "IDLE"
  | "DRAFT"
  | "PENDING"
  | "STARTED"
  | "PAUSED"
  | "ABORTED"
  | "SUCCESS"
  | "SCHEDULED"
  | "FAILURE";

export type StatusFlavor = "job" | "pipeline" | "build";

export const hasEnded = (status: SystemStatus) =>
  status === "ABORTED" || status === "SUCCESS" || status === "FAILURE";

export const statusTitle = (status: SystemStatus, flavor: StatusFlavor) => {
  if (status === "IDLE") {
    return "Ready";
  } else if (
    status === "SCHEDULED" ||
    (status === "PENDING" && flavor === "job")
  ) {
    return "Scheduled";
  } else if (status === "PENDING" && flavor !== "pipeline") {
    return "Waiting";
  } else if (status === "STARTED" && flavor === "build") {
    return "Building";
  } else if (status === "STARTED") {
    return "Running";
  } else if (status === "SUCCESS") {
    return "Completed";
  } else if (status === "FAILURE") {
    return "Failed";
  } else if (status === "ABORTED") {
    return "Canceled";
  } else {
    return capitalize(status.toLowerCase());
  }
};

export const statusColor = (status: SystemStatus | undefined) => {
  switch (status) {
    case "ABORTED":
      return "#ed6c02";
    case "STARTED":
      return blue[700];
    case "FAILURE":
      return red["700"];
    case "SUCCESS":
      return green["800"];
    default:
      return grey["600"];
  }
};

export const statusTextColor = (status: SystemStatus | undefined) => {
  switch (status) {
    case "SUCCESS":
      return alpha("#000", 0.87);
    default:
      return alpha("#000", 0.6);
  }
};
