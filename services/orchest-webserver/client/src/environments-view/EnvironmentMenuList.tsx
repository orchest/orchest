import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
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
  const changes = useEditEnvironment((state) => state.changes);

  const setEnvironment = useEnvironmentsApi((state) => state.setEnvironment);
  const environments = useEnvironmentsApi((state) => state.environments);
  const selectEnvironment = useSelectEnvironment();

  const updateStoreAndRedirect = (event: React.MouseEvent, uuid: string) => {
    const environment = environmentDataFromState(changes);
    if (environment) {
      setEnvironment(environment.uuid, environment);
    }
    selectEnvironment(event, uuid);
  };

  const { environmentUuid } = useCustomRoute();
  const { hasLoadedBuildStatus } = useFetchBuildStatus(environmentUuid);

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
            hasValue(changes) && changes.uuid === environment.uuid;
          const data = selected ? changes : environment;
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
