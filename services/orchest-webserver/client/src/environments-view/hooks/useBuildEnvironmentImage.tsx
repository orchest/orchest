import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";

export const useBuildEnvironmentImage = () => {
  const triggerBuilds = useEnvironmentsApi((state) => state.triggerBuilds);
  const cancelBuild = useEnvironmentsApi((state) => state.cancelBuild);

  return [triggerBuilds, cancelBuild] as const;
};
