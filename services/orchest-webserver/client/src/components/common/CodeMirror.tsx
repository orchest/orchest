import { useEscapeToBlur } from "@/hooks/useEscapeToBlur";
import Box from "@mui/material/Box";
import React from "react";
import type { Controlled as ControlledType } from "react-codemirror2";
import { Controlled, IControlledCodeMirror } from "react-codemirror2";

export type CodeMirrorType = ControlledType;

type CodeMirrorProps = Omit<
  IControlledCodeMirror,
  "onFocus" | "onBlur" | "ref"
>;

export const CodeMirror = React.forwardRef<ControlledType, CodeMirrorProps>(
  function CodeMirror(props: CodeMirrorProps, ref) {
    const [isFocused, setIsFocused] = React.useState(false);

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    useEscapeToBlur();

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
        <Controlled
          {...props}
          ref={ref}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Box>
    );
  }
);
