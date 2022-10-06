import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import React from "react";

export type ErrorSummaryProps = {
  error: unknown;
};

export const ErrorSummary = ({ error }: ErrorSummaryProps) => {
  const { name, message, stack } = extractErrorDetails(error);

  return (
    <>
      <Box marginBottom={2}>
        <Typography variant="body2">
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
        <Alert icon={false} color="error">
          <pre>{stack}</pre>
        </Alert>
      )}
    </>
  );
};

export type ErrorDetails = {
  name: string;
  message?: string;
  stack?: string;
};

const extractErrorDetails = (error: unknown): ErrorDetails => {
  if (!error) {
    return { name: "Unknown error" };
  } else if (error instanceof Error) {
    return error;
  } else if (typeof error === "string") {
    return { name: "Message", message: error };
  } else if (typeof error === "object") {
    return {
      name: error["name"] ?? "Error",
      message: error["message"] ?? undefined,
      stack: error["stack"] ?? undefined,
    };
  } else {
    return { name: "Error", message: String(error) };
  }
};
