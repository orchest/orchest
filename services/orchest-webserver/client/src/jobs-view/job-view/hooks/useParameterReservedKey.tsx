import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";

export const useParameterReservedKey = () => {
  const reservedKey = useOrchestConfigsApi(
    (state) => state.config?.PIPELINE_PARAMETERS_RESERVED_KEY
  );
  return { reservedKey };
};
