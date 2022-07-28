import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useFetchEnvironments } from "@/hooks/useFetchEnvironments";
import { ellipsis } from "@/utils/styles";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { CreateEnvironmentButton } from "./CreateEnvironmentButton";
import { useEnvironmentsStore } from "./stores/useEnvironmentsStore";

export const EnvironmentMenuList = () => {
  const {
    state: { projectUuid },
  } = useProjectsContext();
  const [
    environmentStoreProjectUuid,
    environments,
    selectedEnvironment,
    selectEnvironment,
    initEnvironmentStore,
  ] = useEnvironmentsStore((state) => [
    state.projectUuid,
    state.environments,
    state.selectedEnvironment,
    state.select,
    state.init,
  ]);

  const shouldInitStore =
    projectUuid && environmentStoreProjectUuid !== projectUuid;

  const {
    environments: fetchedEnvironments,
    isFetchingEnvironments,
  } = useFetchEnvironments(shouldInitStore ? projectUuid : undefined);

  React.useEffect(() => {
    if (shouldInitStore && fetchedEnvironments) {
      initEnvironmentStore(projectUuid, fetchedEnvironments);
    }
  }, [shouldInitStore, projectUuid, fetchedEnvironments, initEnvironmentStore]);

  return (
    <Stack
      direction="column"
      sx={{
        width: "100%",
        height: "100%",
        backgroundColor: (theme) => theme.palette.grey[100],
      }}
    >
      <CreateEnvironmentButton sx={{ flexShrink: 0 }} />
      <MenuList
        sx={{
          overflowY: "auto",
          flexShrink: 1,
          paddingTop: 0,
        }}
      >
        {(environments || []).map((environment) => {
          const selected = selectedEnvironment?.uuid === environment.uuid;
          return (
            <MenuItem
              key={environment.uuid}
              tabIndex={0}
              selected={selected}
              divider
              onClick={() => selectEnvironment(environment.uuid)}
              sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Stack
                direction="column"
                alignItems="flex-start"
                justifyContent="center"
                sx={{
                  flexShrink: 1,
                  width: (theme) => `calc(100% - ${theme.spacing(4)})`,
                  margin: (theme) => theme.spacing(1, 0),
                }}
              >
                <Typography variant="body1" sx={ellipsis()}>
                  {environment.name}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    ...ellipsis(),
                    color: (theme) => theme.palette.action.active,
                  }}
                >
                  {environment.language}
                </Typography>
              </Stack>
              <Stack
                justifyContent="center"
                alignItems="center"
                sx={{ paddingLeft: (theme) => theme.spacing(1) }}
              >
                {selected ? (
                  <EditOutlinedIcon fontSize="small" color="action" />
                ) : (
                  <CircularProgress size={20} />
                )}
              </Stack>
            </MenuItem>
          );
        })}
      </MenuList>
    </Stack>
  );
};
