import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import React from "react";

export const useReportEnvironmentsError = (heading = "") => {
  const { setAlert } = useGlobalContext();

  const { error, clearError } = useEnvironmentsApi();

  React.useEffect(() => {
    if (error) {
      setAlert("Error", heading + String(error), () => {
        clearError();
        return true;
      });
    }
  }, [heading, error, clearError, setAlert]);
};
