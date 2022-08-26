import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";

export const useBuildEnvironmentImage = () => {
  const triggerBuilds = useEnvironmentsApi((state) => state.triggerBuilds);
  const cancelBuild = useEnvironmentsApi((state) => state.cancelBuild);
  const isTriggeringBuild = useEnvironmentsApi(
    (state) => state.isTriggeringBuild
  );

  return [triggerBuilds, cancelBuild, isTriggeringBuild] as const;
};
