import { useEscapeToBlur } from "@/hooks/useEscapeToBlur";
import Box from "@mui/material/Box";
import React from "react";
import type { Controlled as ControlledType } from "react-codemirror2";
import { Controlled, IControlledCodeMirror } from "react-codemirror2";

export type CodeMirrorType = ControlledType;

type CodeMirrorProps = Omit<
  IControlledCodeMirror,
  "onFocus" | "onBlur" | "ref"
> & { borderColor?: string };

export const CodeMirror = React.forwardRef<ControlledType, CodeMirrorProps>(
  function CodeMirror({ borderColor, ...props }: CodeMirrorProps, ref) {
    const [isFocused, setIsFocused] = React.useState(false);

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    useEscapeToBlur();

    return (
      <Box
        sx={{
          ".CodeMirror": {
            border: (theme) =>
              `${isFocused ? "2px" : "1px"} solid ${
                isFocused
                  ? theme.palette.primary.main
                  : borderColor || "transparent"
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
