import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";

export const useBuildEnvironmentImage = () => {
  const { triggerBuild, cancelBuild } = useEnvironmentsApi();
  return { triggerBuild, cancelBuild };
};
