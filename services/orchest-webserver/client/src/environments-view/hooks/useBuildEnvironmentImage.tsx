import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";

export const useBuildEnvironmentImage = () => {
  const [
    triggerBuilds,
    cancelBuild,
    isTriggeringBuild,
  ] = useEnvironmentsApi((state) => [
    state.triggerBuilds,
    state.cancelBuild,
    state.isTriggeringBuild,
  ]);
  return [triggerBuilds, cancelBuild, isTriggeringBuild] as const;
};
