import { orchestConfigsApi } from "@/api/system-config/orchestConfigsApi";
import { OrchestConfigs } from "@/types";
import React from "react";
import { useAsync } from "./useAsync";

export const useFetchOrchestConfigs = () => {
  const { run } = useAsync<OrchestConfigs>();
  React.useEffect(() => {
    run(orchestConfigsApi.fetch());
  }, [run]);
};
