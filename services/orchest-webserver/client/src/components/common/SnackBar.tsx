import { useHideIntercom } from "@/hooks/useHideIntercom";
import MuiSnackbar, { SnackbarProps } from "@mui/material/Snackbar";
import React from "react";

export const SnackBar = (props: SnackbarProps) => {
  const isShowingSnackbar = React.useMemo(() => {
    return (
      Boolean(props.open) &&
      props.anchorOrigin?.vertical === "bottom" &&
      props.anchorOrigin?.horizontal === "right"
    );
  }, [
    props.open,
    props.anchorOrigin?.vertical,
    props.anchorOrigin?.horizontal,
  ]);

  useHideIntercom(isShowingSnackbar);

  return <MuiSnackbar {...props} />;
};
