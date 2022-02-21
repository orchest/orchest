import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React from "react";

/**
 * Shows hotkey hint by keydown Ctrl / Cmd key
 */
export const HotKeyHint: React.FC<{
  disabled?: boolean;
  hint: React.ReactNode;
  triggerDelay?: number;
}> = ({ disabled, hint, triggerDelay = 500, children }) => {
  // determine if user is pressing Ctrl / Cmd, if so, UI should show hot key hints
  const [isShowingHints, setIsShowingHints] = React.useState(false);
  const timeout = React.useRef<number>();
  React.useEffect(() => {
    const keyUpHandler = (event: KeyboardEvent) => {
      if (timeout.current) window.clearTimeout(timeout.current);
      setIsShowingHints(event.metaKey || event.ctrlKey);
    };
    const keyDownHandler = (event: KeyboardEvent) => {
      if (timeout.current) window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => {
        keyUpHandler(event);
      }, triggerDelay);
    };
    window.addEventListener("keydown", keyDownHandler);
    window.addEventListener("keyup", keyUpHandler);
    return () => {
      window.removeEventListener("keydown", keyDownHandler);
      window.removeEventListener("keyup", keyUpHandler);
    };
  }, [triggerDelay]);
  return (
    <Box sx={{ position: "relative" }}>
      {children}
      {!disabled && isShowingHints && (
        <Typography
          variant="caption"
          component="div"
          sx={{
            position: "absolute",
            right: (theme) => theme.spacing(0.5),
            bottom: (theme) => theme.spacing(0.5),
            backgroundColor: (theme) => alpha(theme.palette.grey[200], 0.7),
            borderRadius: (theme) => theme.spacing(0.5),
            padding: (theme) => theme.spacing(0, 0.5),
            fontSize: "0.5rem",
          }}
        >
          {hint}
        </Typography>
      )}
    </Box>
  );
};
