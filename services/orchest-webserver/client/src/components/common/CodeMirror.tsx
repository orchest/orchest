import { useEscapeToBlur } from "@/hooks/useEscapeToBlur";
import { Theme } from "@mui/material";
import Box from "@mui/material/Box";
import React from "react";
import { Controlled, IControlledCodeMirror } from "react-codemirror2";

type CodeMirrorProps = Omit<
  IControlledCodeMirror,
  "onFocus" | "onBlur" | "ref"
> & {
  borderColor?: string;
  error?: boolean;
  /** Makes the editor read-only, but also fades the text out and displays a lock icon. */
  locked?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};

export const CodeMirror = React.forwardRef<HTMLDivElement, CodeMirrorProps>(
  function CodeMirror(
    {
      borderColor = "transparent",
      onFocus,
      error,
      onBlur,
      ...props
    }: CodeMirrorProps,
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

    const getBorderColor = (theme: Theme) =>
      error
        ? theme.palette.error.main
        : props?.options?.readOnly
        ? theme.palette.grey[200]
        : isFocused
        ? theme.palette.primary.main
        : borderColor;

    return (
      <Box
        ref={ref}
        sx={{
          position: "relative",
          ".CodeMirror": {
            margin: "-2px",
            border: (theme) => `2px solid ${getBorderColor(theme)} !important`,
          },
        }}
      >
        <Controlled {...props} onFocus={handleFocus} onBlur={handleBlur} />
      </Box>
    );
  }
);
