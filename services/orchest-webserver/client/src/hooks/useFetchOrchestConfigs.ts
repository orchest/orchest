import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import React from "react";
import { useAsync } from "./useAsync";

export const useFetchOrchestConfigs = () => {
  const { run } = useAsync();
  const fetchConfig = useOrchestConfigsApi((state) => state.fetch);
  React.useEffect(() => {
    run(fetchConfig());
  }, [run, fetchConfig]);
};
