import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import create from "zustand";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";

export const useScheduleJobSnackBarMessage = create<{
  message: string | undefined;
  setMessage: (value: string | undefined) => void;
}>((set) => ({
  message: undefined,
  setMessage: (message) => set({ message }),
}));

export const ScheduleJobSnackBar = () => {
  const { navigateTo, projectUuid } = useCustomRoute();
  const {
    uiState: { draftJob },
  } = usePipelineUiStateContext();
  const snackBarMessage = useScheduleJobSnackBarMessage(
    (state) => state.message
  );
  const setSnackBarMessage = useScheduleJobSnackBarMessage(
    (state) => state.setMessage
  );

  // Persists the latest valid job UUID.
  // So that this SnackBar doesn't depend on `draftJob`.
  const latestJobUuidRef = React.useRef<string | undefined>(draftJob);
  React.useEffect(() => {
    if (draftJob) latestJobUuidRef.current = draftJob;
  }, [draftJob]);

  const navigateToJob = () => {
    if (projectUuid) {
      setSnackBarMessage(undefined);
      navigateTo(siteMap.jobs.path, {
        query: { projectUuid, jobUuid: latestJobUuidRef.current },
      });
    }
  };

  const closeSnackBar = () => {
    setSnackBarMessage(undefined);
  };

  return (
    <Snackbar
      open={hasValue(snackBarMessage)}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      autoHideDuration={3000}
      onClose={closeSnackBar}
      message={snackBarMessage}
      action={<Button onClick={navigateToJob}>View job</Button>}
    />
  );
};
