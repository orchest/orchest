import { useInterval } from "@/hooks/use-interval";
import { useFetcher } from "@/hooks/useFetcher";
import { EnvironmentImageBuild } from "@/types";
import { getMostRecentEnvironmentBuildsUrl } from "../common";

export const useMostRecentEnvironmentBuilds = ({
  projectUuid,
  environmentUuid,
  refreshInterval,
}: {
  projectUuid: string | undefined;
  environmentUuid?: string | undefined;
  refreshInterval?: undefined | number;
}) => {
  const { fetchData, data, error } = useFetcher<
    { environment_image_builds: EnvironmentImageBuild[] },
    EnvironmentImageBuild[]
  >(getMostRecentEnvironmentBuildsUrl(projectUuid, environmentUuid), {
    transform: (data) => data.environment_image_builds,
  });

  useInterval(fetchData, refreshInterval);

  return {
    environmentBuilds: data,
    error,
  };
};
