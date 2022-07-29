import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";
import { useAppContext } from "@/contexts/AppContext";
import React from "react";

const selector = (state: EnvironmentsApiState) =>
  [state.error, state.clearError] as const;

export const useReportEnvironmentsError = () => {
  const { setAlert } = useAppContext();

  const [error, clearError] = useEnvironmentsApi(selector);

  React.useEffect(() => {
    if (error) {
      setAlert("Error", String(error), () => {
        clearError();
        return true;
      });
    }
  }, [error, clearError, setAlert]);
};
