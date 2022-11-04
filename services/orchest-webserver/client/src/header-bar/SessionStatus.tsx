import { SnackBar } from "@/components/common/SnackBar";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import ErrorOutline from "@mui/icons-material/ErrorOutline";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import blue from "@mui/material/colors/blue";
import green from "@mui/material/colors/green";
import red from "@mui/material/colors/red";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

type ConnectionStatus = "ok" | "trying" | "failed";

const FAILURES_ERROR = 180;
const FAILURES_TRYING = 5;

export const SessionStatus = () => {
  const { failures, isPolling } = useSessionsPoller();
  const [hadIssue, setHadIssue] = React.useState(false);
  const [status, setStatus] = React.useState<ConnectionStatus>("ok");

  React.useEffect(() => {
    if (status !== "ok") setHadIssue(true);
  }, [status]);

  React.useEffect(() => {
    // Clear the "success message" after some time.
    const handle =
      status === "ok" ? window.setTimeout(() => setHadIssue(false), 2500) : -1;

    return () => window.clearTimeout(handle);
  }, [status]);

  React.useEffect(() => {
    setStatus(
      failures > FAILURES_ERROR
        ? "failed"
        : failures > FAILURES_TRYING
        ? "trying"
        : "ok"
    );

    const handle = window.setTimeout(() => {
      // If there hasn't been a failure for some time
      // we reset the state to remove the banner.
      setStatus("ok");
      setHadIssue(false);
    }, 2500);

    return () => window.clearTimeout(handle);
  }, [failures]);

  if (!isPolling) return null;

  return (
    <>
      <Snackbar
        open={hadIssue && status === "ok"}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message={
          <Stack direction="row" spacing={2} alignItems="center">
            <CheckOutlined sx={{ fill: green[400] }} />

            <Typography variant="subtitle2">Session connected!</Typography>
          </Stack>
        }
      />
      <SnackBar
        open={status === "trying"}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message={
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={24} sx={{ color: blue[200] }} />

            <Typography variant="subtitle2">
              Trying to connect to session…
            </Typography>
          </Stack>
        }
      />
      <SnackBar
        open={status === "failed"}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message={
          <Stack direction="row" spacing={2} alignItems="center">
            <ErrorOutline sx={{ fill: red[500] }} />

            <Box>
              <Typography variant="subtitle2">
                Pipeline runs and JupyterLab unavailable
              </Typography>
              Failed to connect to session
            </Box>
          </Stack>
        }
      />
    </>
  );
};
