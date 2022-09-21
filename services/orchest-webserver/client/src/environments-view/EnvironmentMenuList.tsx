import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { pick } from "@/utils/record";
import MenuList from "@mui/material/MenuList";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { environmentDataFromState } from "./common";
import { CreateEnvironmentButton } from "./CreateEnvironmentButton";
import { EnvironmentMenuItem } from "./EnvironmentMenuItem";
import { useFetchBuildStatus } from "./hooks/useFetchBuildStatus";
import { useSelectEnvironment } from "./hooks/useSelectEnvironment";
import { useSyncEnvironmentUuidWithQueryArgs } from "./hooks/useSyncEnvironmentUuidWithQueryArgs";
import { useEditEnvironment } from "./stores/useEditEnvironment";

export const EnvironmentMenuList = () => {
  useSyncEnvironmentUuidWithQueryArgs();
  const environmentChanges = useEditEnvironment(
    (state) => state.environmentChanges
  );

  const setEnvironment = useEnvironmentsApi((state) => state.setEnvironment);
  const environments = useEnvironmentsApi((state) => state.environments);
  const selectEnvironment = useSelectEnvironment();

  const updateStoreAndRedirect = (uuid: string) => {
    const environment = environmentDataFromState(environmentChanges);
    if (environment) {
      setEnvironment(environment.uuid, environment);
    }
    selectEnvironment(uuid);
  };

  const { hasLoadedBuildStatus } = useFetchBuildStatus();

  return (
    <Stack
      direction="column"
      sx={{
        width: "100%",
        height: "100%",
        backgroundColor: (theme) => theme.palette.grey[100],
      }}
    >
      <CreateEnvironmentButton
        sx={{ flexShrink: 0 }}
        onCreated={selectEnvironment}
      />
      <MenuList
        sx={{
          overflowY: "auto",
          flexShrink: 1,
          paddingTop: 0,
        }}
        tabIndex={0} // MUI's MenuList default is -1
      >
        {(environments || []).map((environment) => {
          const selected =
            hasValue(environmentChanges) &&
            environmentChanges.uuid === environment.uuid;
          const data = selected ? environmentChanges : environment;
          const selectedData = pick(data, "uuid", "name", "language");
          const latestBuildStatus = data.latestBuild?.status;

          return (
            <EnvironmentMenuItem
              key={environment.uuid}
              {...selectedData}
              latestBuildStatus={latestBuildStatus}
              showStatusIcon={hasLoadedBuildStatus}
              onClick={updateStoreAndRedirect}
              selected={selected}
            />
          );
        })}
      </MenuList>
    </Stack>
  );
};
