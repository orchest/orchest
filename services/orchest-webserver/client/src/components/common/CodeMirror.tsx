import { useEscapeToBlur } from "@/hooks/useEscapeToBlur";
import Box from "@mui/material/Box";
import React from "react";
import { Controlled, IControlledCodeMirror } from "react-codemirror2";

type CodeMirrorProps = Omit<
  IControlledCodeMirror,
  "onFocus" | "onBlur" | "ref"
> & {
  borderColor?: string;
  error?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};

export const CodeMirror = React.forwardRef<HTMLDivElement, CodeMirrorProps>(
  function CodeMirror(
    { borderColor, onFocus, error, onBlur, ...props }: CodeMirrorProps,
    ref
  ) {
    const [isFocused, setIsFocused] = React.useState(false);

    const handleFocus = () => {
      setIsFocused(true);
      onFocus?.();
    };
    const handleBlur = () => {
      setIsFocused(false);
      onBlur?.();
    };

    useEscapeToBlur();

    return (
      <Box
        sx={{
          ".CodeMirror": {
            border: (theme) =>
              `$2px solid ${
                error
                  ? theme.palette.error.main
                  : isFocused
                  ? theme.palette.primary.main
                  : borderColor || "transparent"
              } !important`,
          },
        }}
        ref={ref}
      >
        <Controlled {...props} onFocus={handleFocus} onBlur={handleBlur} />
      </Box>
    );
  }
);
