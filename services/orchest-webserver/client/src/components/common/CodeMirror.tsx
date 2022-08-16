import Box from "@mui/material/Box";
import "codemirror/mode/shell/shell";
import React from "react";
import { Controlled, IControlledCodeMirror } from "react-codemirror2";

type CodeMirrorProps = Omit<IControlledCodeMirror, "onFocus" | "onBlur">;

export const CodeMirror = (props: CodeMirrorProps) => {
  const [isFocused, setIsFocused] = React.useState(false);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  React.useEffect(() => {
    const callback = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        const element = document.activeElement as HTMLElement | undefined;
        element?.blur?.();
      }
    };
    window.addEventListener("keydown", callback);
    return () => window.removeEventListener("keydown", callback);
  }, []);

  return (
    <Box
      sx={{
        ".CodeMirror": {
          border: (theme) =>
            `2px solid ${
              isFocused ? theme.palette.primary.main : "transparent"
            } !important`,
        },
      }}
    >
      <Controlled {...props} onFocus={handleFocus} onBlur={handleBlur} />
    </Box>
  );
};
