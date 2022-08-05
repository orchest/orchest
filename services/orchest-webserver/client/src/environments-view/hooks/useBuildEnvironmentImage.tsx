import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";

export const useBuildEnvironmentImage = () => {
  const [
    triggerBuild,
    cancelBuild,
    isTriggeringBuild,
  ] = useEnvironmentsApi((state) => [
    state.triggerBuild,
    state.cancelBuild,
    state.isTriggeringBuild,
  ]);
  return [triggerBuild, cancelBuild, isTriggeringBuild] as const;
};
