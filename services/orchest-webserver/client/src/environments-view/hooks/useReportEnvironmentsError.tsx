import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import React from "react";

export const useReportEnvironmentsError = (heading = "") => {
  const { setAlert } = useGlobalContext();

  const error = useEnvironmentsApi((state) => state.error);
  const clearError = useEnvironmentsApi((state) => state.clearError);

  React.useEffect(() => {
    if (error) {
      setAlert("Error", heading + String(error), () => {
        clearError();
        return true;
      });
    }
  }, [heading, error, clearError, setAlert]);
};
