import { useGlobalContext } from "@/contexts/GlobalContext";

export const useParameterReservedKey = () => {
  const { config } = useGlobalContext();
  const reservedKey = config?.PIPELINE_PARAMETERS_RESERVED_KEY;

  return { reservedKey };
};
