import { useEscapeToBlur } from "@/hooks/useEscapeToBlur";
import LockOutlined from "@mui/icons-material/LockOutlined";
import { Theme } from "@mui/material";
import Box from "@mui/material/Box";
import { grey } from "@mui/material/colors";
import React from "react";
import { Controlled, IControlledCodeMirror } from "react-codemirror2";

type CodeMirrorProps = Omit<
  IControlledCodeMirror,
  "onFocus" | "onBlur" | "ref"
> & {
  borderColor?: string;
  /** Makes the editor read-only, but also fades the text out and displays a lock icon. */
  locked?: boolean;
  error?: boolean;
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
      locked,
      options,
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
        : locked
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
          ".CodeMirror-scroll": {
            opacity: locked ? 0.5 : undefined,
          },
          ".CodeMirror-lines": {
            cursor: locked ? "not-allowed" : undefined,
          },
        }}
      >
        <Controlled
          {...props}
          options={{ ...options, readOnly: locked || options?.readOnly }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {locked && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              right: 0,
              padding: 2,
              pointerEvents: "none",
            }}
          >
            <LockOutlined style={{ fill: grey[200] }} fontSize="small" />
          </Box>
        )}
      </Box>
    );
  }
);
