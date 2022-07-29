import { EnvironmentState } from "@/types";
import { ellipsis } from "@/utils/styles";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PlayCircleFilledWhiteOutlinedIcon from "@mui/icons-material/PlayCircleFilledWhiteOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { CreateEnvironmentButton } from "./CreateEnvironmentButton";
import { useSelectEnvironment } from "./stores/useSelectEnvironment";
import { useValidateEnvironments } from "./stores/useValidateEnvironments";

type ElementStatusIconProps = {
  selected: boolean;
  action?: EnvironmentState["action"];
};

const ElementStatusIcon = ({ selected, action }: ElementStatusIconProps) => {
  if (selected) return <EditOutlinedIcon fontSize="small" color="action" />;
  if (action === "WAIT") return <CircularProgress size={20} />;
  if (action === "RETRY") return <ReplayOutlinedIcon fontSize="small" />;
  if (action === "BUILD")
    return <PlayCircleFilledWhiteOutlinedIcon fontSize="small" />;

  return <CheckCircleOutlineOutlinedIcon fontSize="small" color="success" />;
};

export const EnvironmentMenuList = () => {
  const {
    selectEnvironment,
    environmentOnEdit,
    environments = [],
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
      <CreateEnvironmentButton sx={{ flexShrink: 0 }} />
      <MenuList
        sx={{
          overflowY: "auto",
          flexShrink: 1,
          paddingTop: 0,
        }}
      >
        {environments.map((environment) => {
          const selected = environmentOnEdit?.uuid === environment.uuid;
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
                <ElementStatusIcon
                  selected={selected}
                  action={environment.action}
                />
              </Stack>
            </MenuItem>
          );
        })}
      </MenuList>
    </Stack>
  );
};
