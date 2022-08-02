import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useUpdateQueryArgs } from "@/hooks/useUpdateQueryArgs";
import React from "react";

const selector = (state: EnvironmentsApiState) =>
  [state.projectUuid, state.environments] as const;

export const useSelectEnvironment = () => {
  const { environmentUuid: environmentUuidFromRoute } = useCustomRoute();

  const [environmentUuid, setSelectedUuid] = React.useState<string | undefined>(
    environmentUuidFromRoute
  );

  const updateQueryArgs = useUpdateQueryArgs(250);

  const [projectUuid, environments] = useEnvironmentsApi(selector);

  const environmentOnEdit = React.useMemo(() => {
    const foundEnvironment = environmentUuid
      ? environments?.find((env) => env.uuid === environmentUuid)
      : environments?.[0];

    return foundEnvironment?.uuid;
  }, [environments, environmentUuid]);

  const selectEnvironment = React.useCallback(
    (uuid: string) => {
      setSelectedUuid(uuid);
      updateQueryArgs({ projectUuid, environmentUuid: uuid });
    },
    [updateQueryArgs, projectUuid]
  );

  return { selectEnvironment, environments, environmentOnEdit };
};
