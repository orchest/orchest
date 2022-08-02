import MenuList from "@mui/material/MenuList";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { CreateEnvironmentButton } from "./CreateEnvironmentButton";
import { EnvironmentMenuItem } from "./EnvironmentMenuItem";
import { useSelectEnvironment } from "./stores/useSelectEnvironment";
import { useValidateEnvironments } from "./stores/useValidateEnvironments";

export const EnvironmentMenuList = () => {
  const {
    selectEnvironment,
    environments = [],
    environmentOnEdit,
  } = useSelectEnvironment();

  useValidateEnvironments();

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
            environmentOnEdit === environment.uuid;
          return (
            <EnvironmentMenuItem
              key={environment.uuid}
              {...environment}
              onClick={selectEnvironment}
              selected={selected}
            />
          );
        })}
      </MenuList>
    </Stack>
  );
};
