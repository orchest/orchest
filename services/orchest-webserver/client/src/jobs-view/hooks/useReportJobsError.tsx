import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import React from "react";

export const useReportJobsError = (heading = "") => {
  const { setAlert } = useGlobalContext();

  const error = useJobsApi((state) => state.error);
  const clearError = useJobsApi((state) => state.clearError);

  React.useEffect(() => {
    if (error) {
      setAlert("Error", heading + String(error), () => {
        clearError();
        return true;
      });
    }
  }, [heading, error, clearError, setAlert]);
};
