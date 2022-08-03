import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";

const selector = (state: EnvironmentsApiState) =>
  [state.triggerBuild, state.cancelBuild] as const;

export const useBuildEnvironmentImage = () => {
  const [triggerBuild, cancelBuild] = useEnvironmentsApi(selector);
  return { triggerBuild, cancelBuild };
};
