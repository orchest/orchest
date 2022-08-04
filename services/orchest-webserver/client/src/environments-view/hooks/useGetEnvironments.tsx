import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";

export const useGetEnvironments = () => {
  const { environments } = useEnvironmentsApi();
  return { environments };
};
