import { useToggle } from "@/hooks/useToggle";
import { extractErrorDetails } from "@/utils/error";
import { ArrowRightSharp } from "@mui/icons-material";
import { Collapse, Stack } from "@mui/material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import React from "react";

export type ErrorSummaryProps = {
  /** Some error-like object, string, or similar. */
  error: unknown;
};

export const ErrorSummary = ({ error }: ErrorSummaryProps) => {
  const [showDetails, toggleDetails] = useToggle();
  const { name, message, stack } = extractErrorDetails(error);

  return (
    <>
      <Box>
        <Typography variant="subtitle1">
          {name && (
            <strong>
              {name}
              {message ? ":" : ""}
            </strong>
          )}{" "}
          {message}
        </Typography>
      </Box>
      {stack && (
        <Box marginTop={4}>
          <Stack
            onClick={() => toggleDetails()}
            direction="row"
            justifyContent="flex-start"
            alignItems="center"
            sx={{ cursor: "pointer" }}
          >
            <ArrowRightSharp
              color="action"
              style={{
                transition: "all 250ms ease-out",
                transform: showDetails ? "rotateZ(90deg)" : undefined,
              }}
            />
            <Typography color="text.secondary" variant="caption">
              {showDetails ? "Collapse details" : "Expand details"}
            </Typography>
          </Stack>
          <Collapse orientation="vertical" in={showDetails}>
            <Alert
              icon={false}
              color="error"
              sx={{ marginTop: 2, maxHeight: "320px" }}
            >
              <pre>{stack}</pre>
            </Alert>
          </Collapse>
        </Box>
      )}
    </>
  );
};
