import { useHideIntercom } from "@/hooks/useHideIntercom";
import MuiSnackbar, { SnackbarProps } from "@mui/material/Snackbar";
import React from "react";

export const SnackBar = (props: SnackbarProps) => {
  const overlapsIntercom =
    Boolean(props.open) &&
    props.anchorOrigin?.vertical === "bottom" &&
    props.anchorOrigin?.horizontal === "right";

  useHideIntercom(overlapsIntercom);

  return (
    <MuiSnackbar
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      {...props}
    />
  );
};
