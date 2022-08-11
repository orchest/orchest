import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import React from "react";

const selector = (state: EnvironmentsApiState) =>
  [state.error, state.clearError] as const;

export const useReportEnvironmentsError = (heading = "") => {
  const { setAlert } = useGlobalContext();

  const [error, clearError] = useEnvironmentsApi(selector);

  React.useEffect(() => {
    if (error) {
      setAlert("Error", heading + String(error), () => {
        clearError();
        return true;
      });
    }
  }, [heading, error, clearError, setAlert]);
};
