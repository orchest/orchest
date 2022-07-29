import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";

const selector = (state: EnvironmentsApiState) => state.environments;

export const useGetEnvironments = () => {
  const environments = useEnvironmentsApi(selector);
  return { environments };
};
