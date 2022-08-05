import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import MenuList from "@mui/material/MenuList";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { CreateEnvironmentButton } from "./CreateEnvironmentButton";
import { EnvironmentMenuItem } from "./EnvironmentMenuItem";
import { useSelectEnvironment } from "./hooks/useSelectEnvironment";
import { useSyncEnvironmentUuidWithQueryArgs } from "./hooks/useSyncEnvironmentUuidWithQueryArgs";
import { useUpdateBuildStatus } from "./hooks/useUpdateBuildStatus";
import { useEnvironmentOnEdit } from "./stores/useEnvironmentOnEdit";

export const EnvironmentMenuList = () => {
  useSyncEnvironmentUuidWithQueryArgs();
  const { selectEnvironment } = useSelectEnvironment();
  const { environmentOnEdit } = useEnvironmentOnEdit();
  const { environments = [] } = useEnvironmentsApi();

  const { hasLoadedBuildStatus } = useUpdateBuildStatus();

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
      >
        {environments.map((environment) => {
          const selected =
            hasValue(environmentOnEdit) &&
            environmentOnEdit.uuid === environment.uuid;
          return (
            <EnvironmentMenuItem
              key={environment.uuid}
              {...environment}
              showStatusIcon={hasLoadedBuildStatus}
              onClick={selectEnvironment}
              selected={selected}
            />
          );
        })}
      </MenuList>
    </Stack>
  );
};
